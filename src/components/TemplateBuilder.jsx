import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Rnd } from 'react-rnd';
import { supabase } from '../lib/supabase';
import { ImagePlus, Save, Plus, UploadCloud, Layers, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, GripVertical, Move, RotateCcw, Trash2, Undo2, Redo2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function TemplateBuilder({ preSelectedGroupId, onGroupConsumed }) {
  const [bgUrl, setBgUrl] = useState('');
  const [fields, setFields] = useState([]);
  const [templateName, setTemplateName] = useState('New Template');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const fileInputRef = useRef(null);
  const [editingFieldId, setEditingFieldId] = useState(null);
  // Refs to the actual contentEditable DOM nodes (keyed by field.id)
  const ceRefs = useRef({});
  // Which fields are currently focused — React must NOT touch their DOM
  const activeEditingSet = useRef(new Set());
  // Per-field undo/redo stacks
  const undoStack = useRef({});
  const redoStack = useRef({});

  // Sync state → DOM only for fields that are NOT currently focused.
  // This is the key safety mechanism: React never re-renders a focused contentEditable.
  useLayoutEffect(() => {
    fields.forEach(field => {
      if (field.type !== 'textBlock' && field.name !== 'Custom Text') return;
      const el = ceRefs.current[field.id];
      if (!el || activeEditingSet.current.has(field.id)) return;
      // Only touch the DOM if the content actually differs (avoids cursor jumps)
      if (el.innerHTML !== (field.text || '')) {
        el.innerHTML = field.text || '';
      }
    });
  });

  const cleanFieldContent = (id) => {
    if (window.confirm('Reset this text box? This will clear it so you can re-type your content.')) {
      const clean = 'This is to certify that {{Full Name}}';
      setFields(prev => prev.map(f => f.id === id ? { ...f, text: clean } : f));
      const el = ceRefs.current[id];
      if (el) el.innerHTML = clean;
    }
  };

  const pushUndo = (fieldId, html) => {
    if (!undoStack.current[fieldId]) undoStack.current[fieldId] = [];
    undoStack.current[fieldId].push(html);
    if (undoStack.current[fieldId].length > 50) undoStack.current[fieldId].shift();
    redoStack.current[fieldId] = [];
  };

  const handleUndo = (fieldId) => {
    const stack = undoStack.current[fieldId];
    if (!stack || stack.length === 0) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    if (!redoStack.current[fieldId]) redoStack.current[fieldId] = [];
    redoStack.current[fieldId].push(field.text || '');
    const prev = stack.pop();
    updateField(fieldId, { text: prev });
    const el = ceRefs.current[fieldId];
    if (el) el.innerHTML = prev;
  };

  const handleRedo = (fieldId) => {
    const stack = redoStack.current[fieldId];
    if (!stack || stack.length === 0) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    if (!undoStack.current[fieldId]) undoStack.current[fieldId] = [];
    undoStack.current[fieldId].push(field.text || '');
    const next = stack.pop();
    updateField(fieldId, { text: next });
    const el = ceRefs.current[fieldId];
    if (el) el.innerHTML = next;
  };

  // Date field: 'auto' = today's date at generation time | 'custom' = fixed date
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState('');

  // Group state
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [availableFields, setAvailableFields] = useState([]);
  
  // Template & Preview state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('new');
  const [previewMode, setPreviewMode] = useState(false);
  const [sampleUser, setSampleUser] = useState(null);

  // Fetch groups on mount
  useEffect(() => {
    async function fetchGroups() {
      const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (!error && data) setGroups(data);
    }
    fetchGroups();
  }, []);

  // Auto-select group when navigated from ExcelAnalyzer
  useEffect(() => {
    if (preSelectedGroupId) {
      setSelectedGroupId(preSelectedGroupId);
      if (onGroupConsumed) onGroupConsumed(); // clear it in parent so it doesn't re-trigger
    }
  }, [preSelectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update available fields, templates, and sample user when a group is selected
  useEffect(() => {
    async function fetchGroupData() {
      if (selectedGroupId) {
        // 1. Set available fields
        const group = groups.find(g => g.id === selectedGroupId);
        if (group && Array.isArray(group.columns)) {
          setAvailableFields(group.columns);
        }

        // 2. Fetch existing templates for this group
        const { data: templatesData } = await supabase
          .from('templates')
          .select('*')
          .eq('group_id', selectedGroupId)
          .order('created_at', { ascending: false });
        
        setTemplates(templatesData || []);
        
        // 3. Fetch a sample user for preview mode
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .eq('group_id', selectedGroupId)
          .limit(1);
          
        if (usersData && usersData.length > 0) {
          setSampleUser(usersData[0]);
        } else {
          setSampleUser(null);
        }
      } else {
        setAvailableFields([]);
        setTemplates([]);
        setSampleUser(null);
      }
      
      // Reset editor state
      setFields([]);
      setBgUrl('');
      setTemplateName('New Template');
      setSelectedTemplateId('new');
      setPreviewMode(false);
    }
    fetchGroupData();
  }, [selectedGroupId, groups]);

  // Load template data when an existing template is selected
  useEffect(() => {
    if (selectedTemplateId === 'new') {
      setFields([]);
      setBgUrl('');
      setTemplateName('New Template');
    } else {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        setTemplateName(tpl.name || 'Untitled Template');
        setBgUrl(tpl.background_url || '');
        setFields(tpl.config?.fields || []);
      }
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
      const config = templates[0].config;
      if (config && config.fields) {
        // Migration: Ensure 'Custom Text' fields have the correct type
        const migratedFields = config.fields.map(f => 
          (f.name === 'Custom Text' && !f.type) ? { ...f, type: 'textBlock' } : f
        );
        setFields(migratedFields);
      }
    }
  }, [templates, selectedTemplateId]);


  const getFieldValue = (fieldName) => {
    if (!sampleUser) return `{{${fieldName}}}`;
    
    const fieldNameLower = fieldName.toLowerCase().replace(/\s+/g, '_');
    if (fieldNameLower === 'name') return sampleUser.name || `{{${fieldName}}}`;
    if (fieldNameLower === 'certificate_id') return sampleUser.certificate_id || `{{${fieldName}}}`;
    if (fieldNameLower === 'date') return new Date().toLocaleDateString();
    
    if (sampleUser.extra_data) {
      if (sampleUser.extra_data[fieldName] !== undefined) {
        return String(sampleUser.extra_data[fieldName]);
      }
      const key = Object.keys(sampleUser.extra_data).find(k => k.toLowerCase() === fieldNameLower);
      if (key) return String(sampleUser.extra_data[key]);
    }
    return `{{${fieldName}}}`;
  };

  const getPreviewText = (field) => {
    if (!previewMode || !sampleUser) {
      return (field.type === 'textBlock' || field.name === 'Custom Text') ? (field.text || '') : `{{${field.name}}}`;
    }
    
    // For text blocks, resolve placeholders inside the text
    if (field.type === 'textBlock' || field.name === 'Custom Text') {
      let resolvedText = field.text || '';
      const tags = resolvedText.match(/{{[^{}]+}}/g) || [];
      tags.forEach(tag => {
        const fieldName = tag.replace(/{{|}}/g, '');
        const val = getFieldValue(fieldName);
        const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        resolvedText = resolvedText.replace(regex, val);
      });
      return resolvedText;
    }
    
    return getFieldValue(field.name);
  };

  const addField = (fieldName, type = 'dynamic') => {
    setFields([...fields, {
      id: Date.now().toString(),
      type: type,
      name: fieldName,
      text: type === 'textBlock' ? 'Enter text here...' : '',
      x: 100,
      y: 100,
      width: type === 'textBlock' ? 300 : 200,
      height: type === 'textBlock' ? 80 : 40,
      fontSize: 24,
      lineHeight: 1.2,
      fontFamily: 'Helvetica',
      color: '#000000',
      textAlign: 'center',
      isBold: false,
      isItalic: false,
      isUnderline: false
    }]);
  };

  const handleFieldClick = (fieldName) => {
    const placeholder = `{{${fieldName}}}`;

    if (editingFieldId) {
      const el = ceRefs.current[editingFieldId];
      if (el) {
        el.focus();
        document.execCommand('insertText', false, placeholder);
        // Sync back to state
        updateField(editingFieldId, { text: el.innerHTML });
        return;
      }
    }
    addField(fieldName);
  };

  // Apply bold/italic/underline to the current selection inside contentEditable
  const applyCommand = (command) => {
    if (!editingFieldId) return;
    const el = ceRefs.current[editingFieldId];
    if (!el) return;
    el.focus();
    document.execCommand(command, false, null);
    // Sync the resulting HTML back to state
    updateField(editingFieldId, { text: el.innerHTML });
  };


  const updateField = (id, newProps) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...newProps } : f));
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    setIsUploading(true);
    setSaveStatus(null);
    try {
      const fileName = `${Math.random()}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('templates')
        .getPublicUrl(filePath);

      setBgUrl(data.publicUrl);
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setSaveStatus('upload_error');
    } finally {
      setIsUploading(false);
    }
  };

  const saveTemplate = async () => {
    if (!selectedGroupId) {
      setSaveStatus('no_group');
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const config = { fields };
      
      if (selectedTemplateId === 'new') {
        const { error } = await supabase.from('templates').insert([{
          name: templateName,
          background_url: bgUrl,
          config: config,
          is_active: true,
          group_id: selectedGroupId,
        }]);
        if (error) throw error;
        
        // Refresh templates list to show the new one
        const { data } = await supabase.from('templates').select('*').eq('group_id', selectedGroupId).order('created_at', { ascending: false });
        if (data) {
          setTemplates(data);
          setSelectedTemplateId(data[0].id); // select the newly created one
        }
      } else {
        // Update existing template
        const { error } = await supabase.from('templates').update({
          name: templateName,
          background_url: bgUrl,
          config: config,
        }).eq('id', selectedTemplateId);
        
        if (error) throw error;
        
        // Update local state to avoid refetching everything
        setTemplates(templates.map(t => t.id === selectedTemplateId ? { ...t, name: templateName, background_url: bgUrl, config } : t));
      }
      
      setSaveStatus('success');
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col xl:flex-row gap-6">
      {/* Settings Panel */}
      <div className="w-full xl:w-80 flex-shrink-0 space-y-6 bg-surface-container-low p-6 rounded-2xl border border-white/5">
        <div>
          <h3 className="font-headline mb-4">Template Settings</h3>
          <div className="space-y-4">

            {/* Group Selector */}
            <div>
              <label className="block text-xs text-on-surface-variant uppercase tracking-wider mb-1">Link to Group</label>
              <div className="relative">
                <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-surface-container border border-white/10 rounded-lg pl-8 pr-3 py-2 focus:border-primary outline-none appearance-none text-sm"
                >
                  <option value="">-- Select a Group --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {groups.length === 0 && <p className="text-xs text-on-surface-variant mt-1">No groups yet. Upload an Excel first.</p>}
            </div>

            {/* Template Selector (Only show if a group is selected) */}
            {selectedGroupId && (
              <div className="pt-2">
                <label className="block text-xs text-on-surface-variant uppercase tracking-wider mb-1">Select Template</label>
                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 focus:border-primary outline-none appearance-none text-sm"
                  >
                    <option value="new">+ Create New Template</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-on-surface-variant uppercase tracking-wider mb-1">Template Name</label>
              <input 
                type="text" 
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant uppercase tracking-wider mb-2">Background PDF</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`w-full bg-surface-container border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/5 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <UploadCloud size={24} className="text-primary mb-2" />
                <span className="text-xs text-center text-on-surface-variant">
                  {isUploading ? 'Uploading...' : 'Click to upload PDF template'}
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="application/pdf" 
                  onChange={handleFileUpload}
                />
              </div>
              {saveStatus === 'upload_error' && <p className="text-red-400 text-xs mt-1">Upload failed. Check storage permissions.</p>}
              {bgUrl && <p className="text-green-400 text-xs mt-1 truncate">PDF uploaded successfully.</p>}
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-headline mb-4">Add Fields</h3>
          {!selectedGroupId ? (
            <p className="text-xs text-on-surface-variant bg-white/5 rounded-lg p-3">
              Select a group above to see its available fields.
            </p>
          ) : availableFields.length === 0 ? (
            <p className="text-xs text-on-surface-variant bg-white/5 rounded-lg p-3">
              This group has no columns defined.
            </p>
          ) : (
            <div className="space-y-3">
              <button 
                onClick={() => addField('Custom Text', 'textBlock')}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors text-primary"
              >
                <Plus size={14} /> Add Custom Text Block
              </button>

              {/* Special system fields */}
              <div className="flex flex-wrap gap-2">
                {/* Certificate ID */}
                <button
                  onClick={() => handleFieldClick('Certificate ID')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full text-sm transition-colors text-primary"
                  title="Inserts the auto-generated certificate ID"
                >
                  <Plus size={14} /> Certificate ID
                </button>

                {/* Date field with mode picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(p => !p)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full text-sm transition-colors text-primary"
                    title="Insert a date field"
                  >
                    <Plus size={14} /> Date ▾
                  </button>

                  {showDatePicker && (
                    <div className="absolute top-9 left-0 z-50 bg-surface-container-high border border-white/10 rounded-xl shadow-2xl p-3 w-64">
                      <p className="text-xs font-medium text-on-surface-variant mb-2">Date type</p>

                      {/* Auto date */}
                      <button
                        onClick={() => {
                          // Insert {{Date}} — generator replaces with today's date
                          handleFieldClick('Date');
                          setShowDatePicker(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm mb-1"
                      >
                        📅 Auto — date of generation
                      </button>

                      {/* Custom date */}
                      <div className="space-y-2">
                        <p className="text-xs text-on-surface-variant">📌 Custom fixed date:</p>
                        <input
                          type="date"
                          value={customDate}
                          onChange={e => setCustomDate(e.target.value)}
                          className="w-full bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                        />
                        <button
                          disabled={!customDate}
                          onClick={() => {
                            // Format the custom date nicely and insert as a literal text block
                            const formatted = new Date(customDate + 'T00:00:00').toLocaleDateString('en-US', {
                              day: 'numeric', month: 'long', year: 'numeric'
                            });
                            // Insert as a literal placeholder that gets preserved
                            if (editingFieldId) {
                              const el = ceRefs.current[editingFieldId];
                              if (el) {
                                el.focus();
                                document.execCommand('insertText', false, formatted);
                                updateField(editingFieldId, { text: el.innerHTML });
                                setShowDatePicker(false);
                                return;
                              }
                            }
                            // No active text block — add it as a standalone field
                            const id = Date.now().toString();
                            setFields(prev => [...prev, {
                              id, type: 'dynamic', name: 'Date',
                              text: formatted,
                              x: 100, y: 150, width: 200, height: 40,
                              fontSize: 18, lineHeight: 1.2,
                              fontFamily: 'Helvetica', color: '#000000',
                              textAlign: 'center',
                              isBold: false, isItalic: false, isUnderline: false,
                              dateMode: 'custom', customDateValue: formatted,
                            }]);
                            setShowDatePicker(false);
                          }}
                          className="w-full py-1.5 bg-primary text-on-primary rounded-lg text-sm disabled:opacity-40"
                        >
                          Insert this date
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Excel columns */}
              <div className="flex flex-wrap gap-2">
                {availableFields.map(field => (
                  <button 
                    key={field}
                    onClick={() => handleFieldClick(field)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm transition-colors"
                  >
                    <Plus size={14} /> {field}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-white/5">
          <button 
            onClick={saveTemplate}
            disabled={isSaving || !bgUrl || !selectedGroupId}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
          {saveStatus === 'success' && <p className="text-green-400 text-sm mt-2 text-center">Template Saved!</p>}
          {saveStatus === 'error' && <p className="text-red-400 text-sm mt-2 text-center">Failed to save.</p>}
          {saveStatus === 'no_group' && <p className="text-yellow-400 text-sm mt-2 text-center">Please select a group first.</p>}
        </div>
      </div>


      {/* Canvas Area */}
      <div className="flex-1 bg-surface-container-lowest border border-white/5 rounded-2xl overflow-hidden relative min-h-[600px] flex flex-col items-center justify-center p-4">
        
        {/* Preview Toggle */}
        {bgUrl && selectedGroupId && sampleUser && (
          <div className="absolute top-4 right-4 z-20 bg-surface-container-high rounded-lg p-1 flex shadow-lg border border-white/10">
            <button
              onClick={() => setPreviewMode(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!previewMode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Design Mode
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${previewMode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Preview Mode
            </button>
          </div>
        )}

        {!bgUrl ? (
          <div className="text-center text-on-surface-variant opacity-50">
            <ImagePlus size={48} className="mx-auto mb-4" />
            <p>Upload a background PDF to start building</p>
          </div>
        ) : (
          <div 
            className="relative shadow-2xl bg-white"
            style={{ 
              width: '800px', // We define a fixed editing canvas width
              height: '566px' // Approx A4 Landscape ratio for 800px width
            }}
          >
            {/* Background PDF Rendered as Image */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-90 select-none">
               <Document file={bgUrl} loading={<div className="flex items-center justify-center h-full text-black">Loading PDF Preview...</div>}>
                  <Page 
                    pageNumber={1} 
                    width={800} // Force the PDF page to render exactly at our editing canvas width
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
               </Document>
            </div>

            {/* Draggable Fields Layer */}
            <div className="absolute inset-0 z-10">
              {fields.map((field) => (
                <Rnd
                  key={field.id}
                  bounds="parent"
                  position={{ x: field.x, y: field.y }}
                  size={{ width: field.width, height: field.height }}
                  onDragStop={(e, d) => updateField(field.id, { x: d.x, y: d.y })}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    updateField(field.id, {
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height),
                      ...position,
                    });
                  }}
                  dragHandleClassName="drag-handle"
                  className="border border-primary/50 bg-primary/10 group flex items-center justify-center hover:border-primary"
                  data-field-id={field.id}
                >
                  <div 
                    className="w-full h-full flex flex-col items-center justify-center relative"
                    style={{
                      fontSize: `${field.fontSize}px`,
                      fontFamily: field.fontFamily,
                      color: field.color,
                      textAlign: field.textAlign,
                      textAlignLast: field.textAlign === 'justify' ? 'justify' : 'auto',
                      fontWeight: field.isBold ? 'bold' : 'normal',
                      fontStyle: field.isItalic ? 'italic' : 'normal',
                      textDecoration: field.isUnderline ? 'underline' : 'none',
                      lineHeight: 1
                    }}
                  >
                    {/* Text representation */}
                    <div className="w-full h-full px-2 overflow-hidden flex items-center justify-center">
                      {(field.type === 'textBlock' || field.name === 'Custom Text') && !previewMode ? (
                        <div
                          ref={(el) => { if (el) ceRefs.current[field.id] = el; }}
                          contentEditable
                          suppressContentEditableWarning
                          className="w-full h-full bg-transparent border-none outline-none text-inherit font-inherit focus:ring-1 focus:ring-primary/30 rounded nodrag overflow-auto cursor-text"
                          onFocus={() => {
                            setEditingFieldId(field.id);
                            activeEditingSet.current.add(field.id);
                          }}
                          onBlur={(e) => {
                            activeEditingSet.current.delete(field.id);
                            // 50KB hard cap — absolute safety guard against data corruption
                            let html = e.currentTarget.innerHTML;
                            if (html.length > 50000) html = html.substring(0, 50000);
                            pushUndo(field.id, field.text || '');
                            updateField(field.id, { text: html });
                            setTimeout(() => setEditingFieldId(null), 200);
                          }}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                              e.preventDefault(); handleUndo(field.id);
                            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                              e.preventDefault(); handleRedo(field.id);
                            }
                          }}
                          style={{ textAlign: field.textAlign, textAlignLast: field.textAlign === 'justify' ? 'justify' : 'auto', lineHeight: field.lineHeight || 1.4 }}
                        />
                      ) : (
                        <div
                          className={`${(field.type === 'textBlock' || field.name === 'Custom Text') ? 'whitespace-pre-wrap' : 'truncate'} w-full`}
                          style={{ lineHeight: field.lineHeight }}
                          dangerouslySetInnerHTML={{ __html: previewMode ? getPreviewText(field) : (field.text || '') }}
                        />
                      )}
                    </div>
                    
                    {/* Edit Controls (appear on hover) */}
                    <div className="absolute -top-10 left-0 bg-surface-container-high border border-white/10 rounded-lg p-1 hidden group-hover:flex gap-1 z-50 shadow-xl items-center">
                      <div className="drag-handle cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded text-primary" title="Drag to move">
                        <GripVertical size={16} />
                      </div>
                      
                      <div className="w-px h-4 bg-white/10 mx-1"></div>

                      <select
                        value={field.fontFamily}
                        onChange={(e) => updateField(field.id, { fontFamily: e.target.value })}
                        className="bg-surface-container border border-white/10 text-on-surface text-xs rounded px-1 outline-none h-6"
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times Roman">Times Roman</option>
                        <option value="Courier">Courier</option>
                      </select>
                      
                      <div className="w-px h-4 bg-white/10 mx-1"></div>

                       <input 
                        type="number" 
                        value={field.fontSize} 
                        onChange={(e) => {
                          const newSize = Number(e.target.value);
                          if (window.getSelection().toString()) {
                            // Apply to selection if something is selected
                            // Use a unique command or manual wrap
                            const span = `<span style="font-size: ${newSize}px">${window.getSelection().toString()}</span>`;
                            document.execCommand('insertHTML', false, span);
                          } else {
                            // Apply to entire block if nothing selected
                            updateField(field.id, { fontSize: newSize });
                          }
                        }}
                        className="w-10 bg-transparent text-xs text-on-surface px-1 h-6 outline-none" 
                        title="Font Size"
                      />

                      <div className="flex items-center gap-1 ml-1" title="Line Spacing">
                        <span className="text-[10px] text-on-surface-variant uppercase">LH</span>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0.5"
                          max="3"
                          value={field.lineHeight || 1.2} 
                          onChange={(e) => updateField(field.id, { lineHeight: Number(e.target.value) })}
                          className="w-10 bg-transparent text-xs text-on-surface px-1 h-6 outline-none" 
                        />
                      </div>

                      <input
                        type="color"
                        value={field.color || '#000000'}
                        onChange={(e) => updateField(field.id, { color: e.target.value })}
                        className="w-6 h-6 bg-transparent border-none cursor-pointer"
                        title="Text Color"
                      />
                      
                      <div className="w-px h-4 bg-white/10 mx-1"></div>

                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); applyCommand('bold'); }}
                          className={`p-1 rounded ${document.queryCommandState('bold') ? 'bg-primary/30 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Bold (select text first)"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); applyCommand('italic'); }}
                          className={`p-1 rounded ${document.queryCommandState('italic') ? 'bg-primary/30 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Italic (select text first)"
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); applyCommand('underline'); }}
                          className={`p-1 rounded ${document.queryCommandState('underline') ? 'bg-primary/30 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Underline (select text first)"
                        >
                          <Underline size={14} />
                        </button>

                        <div className="w-px h-4 bg-white/10 mx-1 self-center"></div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleUndo(field.id); }}
                          className="p-1 rounded text-on-surface-variant hover:text-on-surface"
                          title="Undo (Ctrl+Z)"
                        >
                          <Undo2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRedo(field.id); }}
                          className="p-1 rounded text-on-surface-variant hover:text-on-surface"
                          title="Redo (Ctrl+Y)"
                        >
                          <Redo2 size={14} />
                        </button>
                      </div>

                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      
                      <div className="flex border-x border-white/10 px-1 mx-1 gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { textAlign: 'left' }); }}
                          className={`p-1 rounded ${field.textAlign === 'left' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Align Left"
                        >
                          <AlignLeft size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { textAlign: 'center' }); }}
                          className={`p-1 rounded ${field.textAlign === 'center' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Align Center"
                        >
                          <AlignCenter size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { textAlign: 'right' }); }}
                          className={`p-1 rounded ${field.textAlign === 'right' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Align Right"
                        >
                          <AlignRight size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { textAlign: 'justify' }); }}
                          className={`p-1 rounded ${field.textAlign === 'justify' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Justify"
                        >
                          <AlignJustify size={14} />
                        </button>
                      </div>
                      <div className="w-px h-4 bg-white/10 mx-1"></div>

                      <button
                        onClick={(e) => { e.stopPropagation(); cleanFieldContent(field.id); }}
                        className="p-1 rounded text-primary hover:bg-primary/10"
                        title="Reset/Fix Content"
                      >
                        <RotateCcw size={14} />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setFields(fields.filter(f => f.id !== field.id)); }}
                        className="p-1 rounded text-error hover:bg-error/10"
                        title="Delete Field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Rnd>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateBuilder;
