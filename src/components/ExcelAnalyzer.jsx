import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ChevronRight, ChevronLeft, Users, AlertTriangle
} from 'lucide-react';

const STEP_UPLOAD     = 1;
const STEP_SELECT_COLS = 2;
const STEP_MAP_FIELDS  = 3; // NEW: manual field mapping
const STEP_NAME_GROUP  = 4;
const STEP_REVIEW      = 5;

// Keywords for auto-detection
const NAME_KEYS  = ['name'];
const EMAIL_KEYS = ['email', 'mail'];
const PHONE_KEYS = ['phone', 'mobile', 'mob', 'contact', 'ph', 'cell', 'tel'];

const safeStr = (val) => (val !== undefined && val !== null) ? String(val) : '';

const formatKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

function autoDetect(columns, keywords) {
  return columns.find(col => keywords.some(k => formatKey(col).includes(k))) || '';
}

// ── Small helper: a labelled dropdown for picking a column ──
function FieldMapRow({ label, description, icon, value, onChange, columns, isWarning }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${isWarning ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-white/5 border-white/5'}`}>
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface">{label}</p>
        <p className="text-xs text-on-surface-variant">{description}</p>
        {isWarning && (
          <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
            <AlertTriangle size={11} /> Could not auto-detect — please select manually
          </p>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`flex-shrink-0 w-44 bg-surface-container border rounded-lg px-3 py-2 text-sm outline-none ${isWarning && !value ? 'border-yellow-500/60 text-yellow-400' : 'border-white/10 focus:border-primary text-on-surface'}`}
      >
        <option value="">— Not mapped —</option>
        {columns.map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
    </div>
  );
}

function ExcelAnalyzer({ onGroupCreated }) {
  const [step, setStep] = useState(STEP_UPLOAD);
  const [file, setFile] = useState(null);
  const [allColumns, setAllColumns] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({ name: '', email: '', phone: '' });
  const [groupName, setGroupName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importedGroup, setImportedGroup] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    analyzeExcel(selectedFile);
  };

  const analyzeExcel = (file) => {
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length > 0) {
          // 1. Extract and trim headers
          const headers = jsonData[0].map(h => h ? h.toString().trim() : 'Unknown');
          setAllColumns(headers);
          setSelectedColumns(headers);

          // 2. Parse the rest of the rows using our trimmed headers as keys
          // range: 1 skips the original header row in the excel file
          setAllRows(XLSX.utils.sheet_to_json(worksheet, { header: headers, range: 1 }));

          // 3. Auto-detect system field mappings
          setFieldMapping({
            name:  autoDetect(headers, NAME_KEYS),
            email: autoDetect(headers, EMAIL_KEYS),
            phone: autoDetect(headers, PHONE_KEYS),
          });
        }
        setStep(STEP_SELECT_COLS);
      } catch (err) {
        console.error('Error parsing Excel:', err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleColumn = (col) => {
    // Don't allow deselecting a column that is currently mapped as a system field
    const isMapped = Object.values(fieldMapping).includes(col);
    if (isMapped) return;
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const updateMapping = (field, col) => {
    setFieldMapping(prev => ({ ...prev, [field]: col }));
    // Ensure the mapped column is always selected
    if (col && !selectedColumns.includes(col)) {
      setSelectedColumns(prev => [...prev, col]);
    }
  };

  const canProceedFromMapping = fieldMapping.name && fieldMapping.email && fieldMapping.phone;

  const importGroup = async () => {
    if (!groupName.trim()) return;
    setImportStatus('loading');

    try {
      // 1. Create the group — store only extra (non-system) columns as 'columns'
      const extraColumns = selectedColumns.filter(
        col => col !== fieldMapping.name && col !== fieldMapping.email && col !== fieldMapping.phone
      );

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert([{ name: groupName.trim(), columns: [fieldMapping.name, ...extraColumns] }])
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Map rows → users using the explicit fieldMapping
      const usersToInsert = allRows.map(row => {
        const extra = {};

        // Store all selected columns in extra_data
        selectedColumns.forEach(col => {
          extra[col] = safeStr(row[col]);
        });

        return {
          name:  safeStr(row[fieldMapping.name]) || 'Unknown',
          email: safeStr(row[fieldMapping.email]),
          phone: safeStr(row[fieldMapping.phone]),
          certificate_id: `CERT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          is_eligible: true,
          group_id: group.id,
          extra_data: extra,
        };
      });

      const { error: usersError } = await supabase.from('users').insert(usersToInsert);
      if (usersError) throw usersError;

      setImportedGroup({ name: groupName, count: usersToInsert.length, id: group.id });
      setImportStatus('success');
      setStep(STEP_REVIEW);
      if (onGroupCreated) onGroupCreated(group.id);
    } catch (err) {
      console.error('Import error:', err);
      setImportStatus('error');
    }
  };

  const resetWizard = () => {
    setStep(STEP_UPLOAD);
    setFile(null);
    setAllColumns([]);
    setAllRows([]);
    setSelectedColumns([]);
    setFieldMapping({ name: '', email: '', phone: '' });
    setGroupName('');
    setImportStatus(null);
    setImportedGroup(null);
  };

  // ── Progress bar ──
  const stepLabels = ['Upload', 'Columns', 'Map Fields', 'Name Group', 'Done'];
  const currentStepIndex = step - 1;

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
              ${i < currentStepIndex ? 'bg-primary text-on-primary' :
                i === currentStepIndex ? 'bg-primary/30 text-primary ring-2 ring-primary' :
                'bg-white/10 text-on-surface-variant'}`}
            >
              {i < currentStepIndex ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === currentStepIndex ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
              {label}
            </span>
            {i < stepLabels.length - 1 && (
              <div className={`w-6 sm:w-12 h-px ${i < currentStepIndex ? 'bg-primary' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === STEP_UPLOAD && (
        <div
          className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center bg-surface-container-low hover:bg-white/5 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} className="mx-auto mb-4 text-primary opacity-80" />
          <h3 className="text-xl font-headline mb-2">Upload Excel Sheet</h3>
          <p className="text-on-surface-variant text-sm">Click to select a .xlsx or .csv file</p>
          <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
          {isAnalyzing && <p className="mt-4 text-primary animate-pulse">Analyzing file...</p>}
        </div>
      )}

      {/* ── STEP 2: Select Columns ── */}
      {step === STEP_SELECT_COLS && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-white/5 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <FileSpreadsheet className="text-primary" />
            <div>
              <h4 className="font-headline">{file?.name}</h4>
              <p className="text-xs text-on-surface-variant">{allRows.length} rows · {allColumns.length} columns detected</p>
            </div>
          </div>

          <div>
            <h4 className="font-headline text-sm text-secondary mb-1">Select Columns to Include</h4>
            <p className="text-xs text-on-surface-variant mb-4">Toggle which columns to carry into the certificate system. You'll assign Name/Email/Phone in the next step.</p>
            <div className="flex flex-wrap gap-2">
              {allColumns.map((col, i) => {
                const isMapped = Object.values(fieldMapping).includes(col);
                const selected = selectedColumns.includes(col);
                return (
                  <button
                    key={i}
                    onClick={() => toggleColumn(col)}
                    title={isMapped ? 'This column is mapped as a system field and cannot be removed' : ''}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                      ${isMapped ? 'bg-primary/20 text-primary border-primary/40 cursor-default' :
                        selected ? 'bg-secondary/20 text-secondary border-secondary/40' :
                        'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10'}`}
                  >
                    {isMapped && <span className="mr-1">✓</span>}{col}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-white/5">
            <button onClick={resetWizard} className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-sm transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep(STEP_MAP_FIELDS)} className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors text-sm">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Field Mapping ── */}
      {step === STEP_MAP_FIELDS && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-white/5 space-y-6">
          <div>
            <h4 className="font-headline mb-1">Map System Fields</h4>
            <p className="text-on-surface-variant text-sm">
              The system needs to know which column in your Excel contains each required piece of data.
              We've made our best guess — correct any that are wrong.
            </p>
          </div>

          <div className="space-y-3">
            <FieldMapRow
              label="Name Column"
              description="The student's full name used on the certificate"
              icon="👤"
              value={fieldMapping.name}
              onChange={col => updateMapping('name', col)}
              columns={allColumns}
              isWarning={!fieldMapping.name}
            />
            <FieldMapRow
              label="Email Column"
              description="Used for identity verification on the portal"
              icon="✉️"
              value={fieldMapping.email}
              onChange={col => updateMapping('email', col)}
              columns={allColumns}
              isWarning={!fieldMapping.email}
            />
            <FieldMapRow
              label="Phone / Mobile Column"
              description="Used together with email to identify the student"
              icon="📱"
              value={fieldMapping.phone}
              onChange={col => updateMapping('phone', col)}
              columns={allColumns}
              isWarning={!fieldMapping.phone}
            />
          </div>

          {/* Preview of first row with current mapping */}
          {allRows.length > 0 && canProceedFromMapping && (
            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl text-xs space-y-1">
              <p className="font-medium text-green-400 mb-2">✓ Preview (first row)</p>
              <p><span className="text-on-surface-variant">Name:</span> <span className="text-on-surface">{safeStr(allRows[0][fieldMapping.name]) || '—'}</span></p>
              <p><span className="text-on-surface-variant">Email:</span> <span className="text-on-surface">{safeStr(allRows[0][fieldMapping.email]) || '—'}</span></p>
              <p><span className="text-on-surface-variant">Phone:</span> <span className="text-on-surface">{safeStr(allRows[0][fieldMapping.phone]) || '—'}</span></p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-white/5">
            <button onClick={() => setStep(STEP_SELECT_COLS)} className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-sm transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep(STEP_NAME_GROUP)}
              disabled={!canProceedFromMapping}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors text-sm"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Name the Group ── */}
      {step === STEP_NAME_GROUP && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-white/5 space-y-6">
          <div>
            <h4 className="font-headline mb-1">Name This Group</h4>
            <p className="text-on-surface-variant text-sm mb-6">Give this batch a descriptive name. It will appear in the Template Builder.</p>

            <label className="block text-xs text-on-surface-variant uppercase tracking-wider mb-2">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Batch 2024 – Python Certificate"
              className="w-full bg-surface-container border border-white/10 rounded-lg px-4 py-3 focus:border-primary outline-none text-on-surface placeholder:text-on-surface-variant/50"
            />

            <div className="mt-4 p-3 bg-white/5 rounded-xl text-xs text-on-surface-variant space-y-1">
              <p className="font-medium text-on-surface mb-1">Summary</p>
              <p>· <span className="text-primary font-medium">{allRows.length}</span> users will be imported</p>
              <p>· Name from: <span className="text-primary">{fieldMapping.name}</span></p>
              <p>· Email from: <span className="text-primary">{fieldMapping.email}</span></p>
              <p>· Phone from: <span className="text-primary">{fieldMapping.phone}</span></p>
              <p>· Extra columns: <span className="text-primary">
                {selectedColumns.filter(c => c !== fieldMapping.name && c !== fieldMapping.email && c !== fieldMapping.phone).join(', ') || 'None'}
              </span></p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-white/5">
            <button onClick={() => setStep(STEP_MAP_FIELDS)} className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-sm transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={importGroup}
              disabled={!groupName.trim() || importStatus === 'loading'}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
            >
              {importStatus === 'loading' ? 'Importing...' : <><Users size={14} /> Create Group & Import</>}
            </button>
          </div>
          {importStatus === 'error' && (
            <p className="text-red-400 flex items-center gap-2 text-sm"><AlertCircle size={14} /> Import failed. Check console.</p>
          )}
        </div>
      )}

      {/* ── STEP 5: Success ── */}
      {step === STEP_REVIEW && importedGroup && (
        <div className="bg-surface-container-low rounded-2xl p-8 border border-white/5 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green-400" />
          <h4 className="font-headline text-xl">Group Created Successfully!</h4>
          <p className="text-on-surface-variant text-sm">
            <span className="text-primary font-medium">{importedGroup.count}</span> users imported into{' '}
            <span className="text-secondary font-medium">"{importedGroup.name}"</span>.
          </p>
          <p className="text-on-surface-variant text-sm">
            You've been switched to the <strong>Templates</strong> tab — the group is already selected for you.
          </p>
          <button onClick={resetWizard} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-colors">
            Upload Another Sheet
          </button>
        </div>
      )}
    </div>
  );
}

export default ExcelAnalyzer;
