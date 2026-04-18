import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { supabase } from '../lib/supabase';
import { ImagePlus, Save, Plus, UploadCloud, Layers, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from 'lucide-react';
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


  const getPreviewText = (field) => {
    if (!previewMode || !sampleUser) return `{{${field.name}}}`;
    
    const fieldNameLower = field.name.toLowerCase().replace(/\s+/g, '_');
    if (fieldNameLower === 'name') return sampleUser.name || `{{${field.name}}}`;
    if (fieldNameLower === 'certificate_id') return sampleUser.certificate_id || `{{${field.name}}}`;
    if (fieldNameLower === 'date') return new Date().toLocaleDateString();
    
    if (sampleUser.extra_data) {
      if (sampleUser.extra_data[field.name] !== undefined) {
        return String(sampleUser.extra_data[field.name]);
      }
      const key = Object.keys(sampleUser.extra_data).find(k => k.toLowerCase() === fieldNameLower);
      if (key) return String(sampleUser.extra_data[key]);
    }
    return `{{${field.name}}}`;
  };

  const addField = (fieldName) => {
    setFields([...fields, {
      id: Date.now().toString(),
      name: fieldName,
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      fontSize: 24,
      fontFamily: 'Helvetica',
      color: '#000000',
      textAlign: 'center',
      isBold: false,
      isItalic: false,
      isUnderline: false
    }]);
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
            <div className="flex flex-wrap gap-2">
              {availableFields.map(field => (
                <button 
                  key={field}
                  onClick={() => addField(field)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm transition-colors"
                >
                  <Plus size={14} /> {field}
                </button>
              ))}
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
                  className="border border-primary/50 bg-primary/10 group flex items-center justify-center hover:border-primary"
                >
                  <div 
                    className="w-full h-full flex flex-col items-center justify-center relative"
                    style={{
                      fontSize: `${field.fontSize}px`,
                      fontFamily: field.fontFamily,
                      color: field.color,
                      textAlign: field.textAlign,
                      fontWeight: field.isBold ? 'bold' : 'normal',
                      fontStyle: field.isItalic ? 'italic' : 'normal',
                      textDecoration: field.isUnderline ? 'underline' : 'none',
                      lineHeight: 1
                    }}
                  >
                    {/* Text representation */}
                    <span className="truncate w-full px-2">
                      {getPreviewText(field)}
                    </span>
                    
                    {/* Edit Controls (appear on hover) */}
                    <div className="absolute -top-10 left-0 bg-surface-container-high border border-white/10 rounded-lg p-1 hidden group-hover:flex gap-1 z-50 shadow-xl items-center">
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
                        onChange={(e) => updateField(field.id, { fontSize: Number(e.target.value) })}
                        className="w-10 bg-transparent text-xs text-on-surface px-1 h-6 outline-none" 
                        title="Font Size"
                      />
                      <input 
                        type="color" 
                        value={field.color} 
                        onChange={(e) => updateField(field.id, { color: e.target.value })}
                        className="w-6 h-6 bg-transparent border-none cursor-pointer" 
                        title="Color"
                      />
                      
                      <div className="w-px h-4 bg-white/10 mx-1"></div>

                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { isBold: !field.isBold }); }}
                          className={`p-1 rounded ${field.isBold ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Bold"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { isItalic: !field.isItalic }); }}
                          className={`p-1 rounded ${field.isItalic ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Italic"
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateField(field.id, { isUnderline: !field.isUnderline }); }}
                          className={`p-1 rounded ${field.isUnderline ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                          title="Underline"
                        >
                          <Underline size={14} />
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
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                        className="text-red-400 hover:text-red-300 px-1 text-xs"
                      >
                        Remove
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
