import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Upload, FileText, User, DollarSign, Calendar, Info, AlertCircle, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  options?: string[];
  prefix?: string;
  readOnly?: boolean;
};

const SECTIONS: { id: string; title: string; icon: React.ElementType; fields: FieldConfig[] }[] = [
  {
    id: 'claimant',
    title: 'Claimant Info',
    icon: User,
    fields: [
      { id: 'cl-first', label: 'First Name', type: 'text' },
      { id: 'cl-middle', label: 'Middle Name', type: 'text' },
      { id: 'cl-last', label: 'Last Name', type: 'text' },
      { id: 'cl-ssn', label: 'SSN', type: 'text' },
      { id: 'cl-dob', label: 'Date of Birth', type: 'date' },
      { id: 'cl-phone', label: 'Phone', type: 'text' },
      { id: 'cl-address', label: 'Address', type: 'text' },
      { id: 'cl-csz', label: 'City, State, Zip', type: 'text' },
      { id: 'cl-pob', label: 'Place of Birth', type: 'text' },
      { id: 'cl-mother', label: 'Mother\'s Maiden Name', type: 'text' },
      { id: 'cl-father', label: 'Father\'s Name', type: 'text' },
    ]
  },
  {
    id: 'office',
    title: 'Office & Claim',
    icon: Info,
    fields: [
      { id: 'claim-type', label: 'Claim Type', type: 'select', options: ['T2 Only', 'T16 Only', 'Concurrent'] },
      { id: 'notice-date', label: 'Notice Date', type: 'date' },
      { id: 'ssa-fo-phone', label: 'FO Phone', type: 'text' },
      { id: 'ssa-fo-fax', label: 'FO Fax', type: 'text' },
      { id: 'ssa-pc-phone', label: 'PC Phone', type: 'text' },
      { id: 'ssa-pc-fax', label: 'PC Fax', type: 'text' },
      { id: 'office-notes', label: 'Office Notes', type: 'textarea' },
    ]
  },
  {
    id: 't2',
    title: 'T2 (SSDI)',
    icon: Calendar,
    fields: [
      { id: 't2-filing', label: 'Filing Date', type: 'date' },
      { id: 't2-aod', label: 'AOD', type: 'date' },
      { id: 't2-eod', label: 'EOD', type: 'date' },
      { id: 't2-doe', label: 'DOE', type: 'date' },
      { id: 't2-dli', label: 'DLI', type: 'date' },
      { id: 't2-pia', label: 'PIA (Monthly)', type: 'number', prefix: '$' },
      { id: 't2-fm', label: 'Family Max', type: 'number', prefix: '$' },
      { id: 't2-gross', label: 'T2 Gross Retro', type: 'number', prefix: '$', readOnly: true },
    ]
  },
  {
    id: 'fees',
    title: 'Fees & Aux',
    icon: DollarSign,
    fields: [
      { id: 'fee-status', label: 'Fee Status', type: 'select', options: ['Approved', 'Denied'] },
      { id: 'fee-petition', label: 'Fee Petition', type: 'select', options: ['No', 'Yes'] },
      { id: 'petition-amount', label: 'Petition Amount', type: 'number', prefix: '$' },
      { id: 't2-fee-due', label: 'T2 Fee Due', type: 'number', prefix: '$', readOnly: true },
      { id: 't2-fee-paid', label: 'T2 Fee Paid', type: 'number', prefix: '$' },
      { id: 't16-fee-due', label: 'T16 Fee Due', type: 'number', prefix: '$', readOnly: true },
      { id: 't16-fee-paid', label: 'T16 Fee Paid', type: 'number', prefix: '$' },
      { id: 'aux-children', label: 'Aux Children', type: 'text' },
      { id: 'aux-num-children', label: 'Num Children', type: 'number' },
      { id: 'aux-retro', label: 'Aux Retro', type: 'number', prefix: '$', readOnly: true },
      { id: 'aux-fee-due', label: 'Aux Fee Due', type: 'number', prefix: '$', readOnly: true },
      { id: 'aux-fee-paid', label: 'Aux Fee Paid', type: 'number', prefix: '$' },
    ]
  },
  {
    id: 't16',
    title: 'T16 (SSI)',
    icon: Calendar,
    fields: [
      { id: 't16-pfd', label: 'PFD', type: 'date' },
      { id: 't16-eod', label: 'EOD', type: 'date' },
      { id: 't16-doe', label: 'DOE', type: 'date' },
      { id: 't16-retro-months', label: 'Retro Months', type: 'number', readOnly: true },
      { id: 't16-monthly', label: 'SSI Monthly (Optional)', type: 'number', prefix: '$' },
      { id: 't16-gross', label: 'T16 Gross Retro', type: 'number', prefix: '$' },
      { id: 't16-state-repay', label: 'State Repay', type: 'number', prefix: '$' },
      { id: 't16-notes', label: 'T16 Notes', type: 'textarea' },
    ]
  },
  {
    id: 'perc',
    title: 'PERC & Offsets',
    icon: FileText,
    fields: [
      { id: 'perc-marital', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Separated', 'Divorced', 'Widowed'] },
      { id: 'perc-pah', label: 'PAH', type: 'select', options: ['No', 'Yes'] },
      { id: 'perc-la-type', label: 'LA Type', type: 'select', options: ['A', 'B', 'C', 'D', 'Transient'] },
      { id: 'perc-children', label: 'Children', type: 'text' },
      { id: 'perc-family-details', label: 'Family Details', type: 'textarea' },
      { id: 'wc-offset', label: 'WC Offset', type: 'text' },
      { id: 'windfall-offset', label: 'Windfall Offset', type: 'text' },
      { id: 't2-wc-monthly', label: 'T2 WC Monthly', type: 'number', prefix: '$' },
      { id: 't2-wc-settlement', label: 'T2 WC Settlement', type: 'number', prefix: '$' },
      { id: 'res-cash', label: 'Cash', type: 'number', prefix: '$' },
      { id: 'res-bank-current', label: 'Bank Current', type: 'number', prefix: '$' },
      { id: 'inc-earned', label: 'Earned Income', type: 'number', prefix: '$' },
      { id: 'perc-va', label: 'VA Benefits', type: 'number', prefix: '$' },
    ]
  }
];

const INITIAL_STATE: Record<string, any> = {
  'claim-type': 'T2 Only',
  'fee-status': 'Approved',
  'fee-petition': 'No',
  'perc-marital': 'Single',
  'perc-pah': 'No',
  'perc-la-type': 'A',
};

export default function App() {
  const [data, setData] = useState<Record<string, any>>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateTotals = React.useCallback(() => {
    const calculateMonths = (start: string, end: string) => {
      if (!start || !end) return 0;
      const d1 = new Date(start);
      const d2 = new Date(end);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
      
      let months = (d2.getFullYear() - d1.getFullYear()) * 12;
      months -= d1.getMonth();
      months += d2.getMonth();
      return months <= 0 ? 0 : months;
    };

    const payableMonthsT2 = calculateMonths(data['t2-doe'], data['notice-date']);
    const payableMonthsT16 = calculateMonths(data['t16-doe'], data['notice-date']);
    
    const pia = parseFloat(data['t2-pia']) || 0;
    const fm = parseFloat(data['t2-fm']) || 0;
    const t16Monthly = parseFloat(data['t16-monthly']) || 0;

    const t2Gross = pia * payableMonthsT2;
    const auxRetro = (fm > pia) ? (fm - pia) * payableMonthsT2 : 0;
    
    let t16Gross = parseFloat(data['t16-gross']) || 0;
    let shouldUpdateT16Gross = false;

    if (t16Monthly > 0 && payableMonthsT16 > 0) {
      const calculatedT16Gross = t16Monthly * payableMonthsT16;
      if (t16Gross !== calculatedT16Gross) {
        t16Gross = calculatedT16Gross;
        shouldUpdateT16Gross = true;
      }
    }

    const totalRetro = t2Gross + t16Gross + auxRetro;
    
    let t2Fee = 0;
    let t16Fee = 0;
    let auxFee = 0;

    if (data['fee-status'] === 'Approved') {
      let maxFee = 0;
      if (data['fee-petition'] === 'Yes') {
        maxFee = parseFloat(data['petition-amount']) || 0;
      } else {
        maxFee = Math.min(totalRetro * 0.25, 9200);
      }

      if (totalRetro > 0) {
        t2Fee = (t2Gross / totalRetro) * maxFee;
        t16Fee = (t16Gross / totalRetro) * maxFee;
        auxFee = (auxRetro / totalRetro) * maxFee;
      }
    }

    setData(prev => {
      const updates: Record<string, any> = {};
      
      const format = (val: number) => val > 0 ? val.toFixed(2) : '';
      const formatZero = (val: number) => val > 0 ? val.toFixed(2) : '0.00';

      if (prev['t2-gross'] !== format(t2Gross)) updates['t2-gross'] = format(t2Gross);
      if (prev['aux-retro'] !== format(auxRetro)) updates['aux-retro'] = format(auxRetro);
      if (prev['t16-retro-months'] !== String(payableMonthsT16 || '')) updates['t16-retro-months'] = String(payableMonthsT16 || '');
      
      if (shouldUpdateT16Gross && prev['t16-gross'] !== format(t16Gross)) {
        updates['t16-gross'] = format(t16Gross);
      }

      if (prev['t2-fee-due'] !== formatZero(t2Fee)) updates['t2-fee-due'] = formatZero(t2Fee);
      if (prev['t16-fee-due'] !== formatZero(t16Fee)) updates['t16-fee-due'] = formatZero(t16Fee);
      if (prev['aux-fee-due'] !== formatZero(auxFee)) updates['aux-fee-due'] = formatZero(auxFee);

      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [
    data['t2-doe'], data['t16-doe'], data['notice-date'], 
    data['t2-pia'], data['t2-fm'], data['t16-monthly'], data['t16-gross'],
    data['fee-status'], data['fee-petition'], data['petition-amount']
  ]);

  // Auto-calculate fields
  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const handleRecalculate = () => {
    calculateTotals();
  };

  const handleChange = (id: string, value: string) => {
    setData(prev => ({ ...prev, [id]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsExtracting(true);
    setError(null);

    try {
      const filePromises = Array.from(files).map((file: File) => {
        return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = (event.target?.result as string).split(',')[1];
            resolve({ mimeType: file.type, data: base64Data });
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      });

      const fileParts = await Promise.all(filePromises);

      const parts: any[] = fileParts.map(fp => ({
        inlineData: {
          data: fp.data,
          mimeType: fp.mimeType,
        }
      }));

      parts.push({
        text: `You are an expert Social Security Disability (SSD) case processor. Extract information from the uploaded document(s) and return a JSON object mapping form field IDs to their values.
                
CRITICAL INSTRUCTIONS:
- Respond with ONLY a valid JSON object mapping the exact field IDs to their values. No markdown fences.
- Omit fields if the info is not present — do not guess or use $0.00 defaults.
- DATE FORMAT: YYYY-MM-DD.
- NUMBER FORMAT: Plain numbers only (e.g., 12500.00).

CROSS-REFERENCING OFFICE DIRECTORIES & LOOKUP:
You MUST look up the correct Field Office (FO) and Payment Center (PC) phone and fax numbers using the extracted information and put them in their respective fields:
- Field Office (ssa-fo-phone, ssa-fo-fax): Use the claimant's ZIP code to find the local FO phone and fax numbers. If directories are uploaded, use them. Otherwise, use Google Search to find the SSA Field Office phone and fax numbers for that ZIP code.
- Payment Center (ssa-pc-phone, ssa-pc-fax): Use the claimant's age and SSN to determine the correct Payment Center. If directories are uploaded, use them. Otherwise, use Google Search or your knowledge of SSN routing rules to find the correct PC phone and fax numbers.

CALCULATING BACKPAY FROM PIA & FM:
If the total gross retroactive backpay amounts are not explicitly stated, you MUST calculate them using the Primary Insurance Amount (PIA) and Family Maximum (FM):
1. Claimant base monthly = PIA (extract to "t2-pia").
2. Total monthly auxiliary pool = (FM - PIA) (extract FM to "t2-fm").
3. Determine payable months from Date of Entitlement (DOE) to Notice date.
4. "t2-gross" = (PIA * payable months).
5. "aux-retro" = ((FM - PIA) * payable months) if there are eligible dependents.

FIELD ID MAP:
"claim-type", "cl-first", "cl-middle", "cl-last", "cl-ssn", "cl-dob", "cl-phone", "cl-address", "cl-csz", "cl-pob", "cl-mother", "cl-father", "ssa-fo-phone", "ssa-fo-fax", "ssa-pc-phone", "ssa-pc-fax", "office-notes", "fee-status", "fee-petition", "time-del", "reason-fee-denied", "date-petition-sent", "date-petition-app", "petition-amount", "t2-filing", "t2-aod", "t2-eod", "t2-doe", "t2-dli", "t2-pia", "t2-fm", "t2-gross", "t2-fee-due", "t2-fee-paid", "wc-offset", "windfall-offset", "t2-wc-start", "t2-wc-stop", "t2-wc-monthly", "t2-wc-settlement", "t2-wc-left", "t2-wc-spent", "perc-marital", "perc-children", "perc-pah", "perc-family-details", "perc-la-type", "perc-expenses-total", "perc-expenses-claimant", "perc-la-changes", "res-cash", "res-bank-high", "res-bank-current", "res-vehicles", "res-other", "inc-earned", "inc-spouse", "perc-ltd", "perc-va", "perc-other-unearned", "perc-wc-start", "perc-wc-stop", "perc-wc-monthly", "perc-wc-settlement", "perc-wc-left", "perc-wc-spent", "perc-inh-date", "perc-inh-amount", "perc-inh-left", "perc-inh-spent", "t16-pfd", "t16-eod", "t16-doe", "t16-retro-months", "t16-gross", "t16-state-repay", "t16-fee-due", "t16-fee-paid", "t16-notes", "aux-children", "aux-num-children", "aux-retro", "aux-fee-due", "aux-fee-paid", "cdr-cease", "cdr-eod", "cdr-doe", "cdr-retro", "notice-date"`
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ parts }],
        config: {
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }]
        }
      });

      if (response.text) {
        const extractedData = JSON.parse(response.text);
        setData(prev => ({ ...prev, ...extractedData }));
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError(err.message || "Failed to extract data from document(s).");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = data[field.id] || '';

    return (
      <div key={field.id} className="flex flex-col mb-4">
        <label className="text-sm font-medium text-slate-700 mb-1" htmlFor={field.id}>
          {field.label}
        </label>
        <div className="relative">
          {field.prefix && (
            <span className="absolute left-3 top-2 text-slate-500">{field.prefix}</span>
          )}
          
          {field.type === 'select' ? (
            <select
              id={field.id}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              disabled={field.readOnly}
              className={`w-full border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${field.readOnly ? 'bg-slate-50 cursor-not-allowed' : ''}`}
            >
              <option value="">Select...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              id={field.id}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              readOnly={field.readOnly}
              rows={3}
              className={`w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${field.readOnly ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
            />
          ) : (
            <input
              id={field.id}
              type={field.type}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              readOnly={field.readOnly}
              className={`w-full border border-slate-300 rounded-md px-3 py-2 ${field.prefix ? 'pl-8' : ''} ${field.readOnly ? 'bg-slate-50 cursor-not-allowed text-slate-600 font-medium' : 'bg-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
            />
          )}
        </div>
      </div>
    );
  };

  const activeSection = SECTIONS.find(s => s.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">SSD Benefits Calculator</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              multiple
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg,.csv" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isExtracting ? 'Extracting...' : 'Upload Document(s)'}
            </button>
            <button 
              onClick={handleRecalculate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-medium transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Recalculate
            </button>
            <button 
              onClick={() => setData(INITIAL_STATE)}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md font-medium transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </header>

      {/* Quick Summary Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Summary</span>
              </div>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Claim Type</p>
                  <p className="text-sm font-medium">{data['claim-type'] || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">T2 Gross Retro</p>
                  <p className="text-sm font-mono font-medium text-emerald-600">
                    {data['t2-gross'] ? `$${data['t2-gross']}` : '$0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">T16 Gross Retro</p>
                  <p className="text-sm font-mono font-medium text-emerald-600">
                    {data['t16-gross'] ? `$${data['t16-gross']}` : '$0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Aux Retro</p>
                  <p className="text-sm font-mono font-medium text-emerald-600">
                    {data['aux-retro'] ? `$${data['aux-retro']}` : '$0.00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-indigo-50 px-4 py-1.5 rounded-md border border-indigo-100 flex items-center gap-3">
              <p className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">Total Fee Due</p>
              <p className="text-base font-mono font-bold text-indigo-700">
                ${((parseFloat(data['t2-fee-due']) || 0) + (parseFloat(data['t16-fee-due']) || 0) + (parseFloat(data['aux-fee-due']) || 0)).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Error extracting data</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col gap-1">
              {SECTIONS.map(section => {
                const Icon = section.icon;
                const isActive = activeTab === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Form Area */}
          <div className="flex-1">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  {activeSection && <activeSection.icon className="w-5 h-5 text-slate-500" />}
                  {activeSection?.title}
                </h2>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                  {activeSection?.fields.map(field => (
                    <div key={field.id} className={field.type === 'textarea' ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
