import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Upload, FileText, User, DollarSign, Calendar, Info, AlertCircle, Loader2, Save, Trash2, Users, Plus, X, Printer, Search } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ErrorBoundary } from 'react-error-boundary';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  options?: string[];
  prefix?: string;
  readOnly?: boolean;
  className?: string;
  visible?: (data: Record<string, any>) => boolean;
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
      { id: 'cl-address', label: 'Address', type: 'text', className: 'col-span-1 md:col-span-2' },
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
      { id: 'stage-approved', label: 'Stage Approved', type: 'select', options: ['Initial', 'Recon', 'Hearing', 'AC', 'Federal'] },
      { id: 'ssa-fo-name', label: 'FO Name', type: 'text' },
      { id: 'ssa-fo-phone', label: 'FO Phone', type: 'text' },
      { id: 'ssa-fo-fax', label: 'FO Fax', type: 'text' },
      { id: 'ssa-pc-name', label: 'PC Name', type: 'text' },
      { id: 'ssa-pc-phone', label: 'PC Phone', type: 'text' },
      { id: 'ssa-pc-fax', label: 'PC Fax', type: 'text' },
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
      { id: 't2-retro-months', label: 'Retro Months', type: 'number', readOnly: true },
      { id: 't2-gross', label: 'T2 Gross Retro', type: 'number', prefix: '$' },
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
      { id: 'reps-list', label: 'Representatives (Name & Rep ID)', type: 'textarea' },
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
    ]
  },
  {
    id: 'perc',
    title: 'PERC & Offsets',
    icon: FileText,
    fields: [
      { id: 'perc-marital', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Separated', 'Divorced', 'Widowed'] },
      { id: 'perc-pah', label: 'PAH', type: 'select', options: ['No', 'Yes'] },
      { id: 'perc-la-type', label: 'LA Type', type: 'select', options: ['A (Own household)', 'B (Another\'s household)', 'C (Child under 18)', 'D (Institution)', 'Transient'] },
      { id: 'perc-children', label: 'Children', type: 'text' },
      { id: 'perc-family-details', label: 'Family Details', type: 'textarea' },
      { id: 'perc-inheritance', label: 'Did you receive an Inheritance after the filing date', type: 'select', options: ['No', 'Yes'] },
      { id: 'perc-inh-date', label: 'Inheritance Date', type: 'date', visible: (data) => data['perc-inheritance'] === 'Yes' },
      { id: 'perc-inh-amount', label: 'Inheritance Amount', type: 'number', prefix: '$', visible: (data) => data['perc-inheritance'] === 'Yes' },
      { id: 'perc-inh-spent', label: 'How Spent?', type: 'textarea', visible: (data) => data['perc-inheritance'] === 'Yes' },
      { id: 'perc-wc-after-aod', label: 'Did you receive WC after the AOD?', type: 'select', options: ['No', 'Yes'] },
      { id: 't2-wc-monthly', label: 'T2 WC Monthly', type: 'number', prefix: '$', visible: (data) => data['perc-wc-after-aod'] === 'Yes' },
      { id: 't2-wc-settlement', label: 'T2 WC Settlement', type: 'number', prefix: '$', visible: (data) => data['perc-wc-after-aod'] === 'Yes' },
      { id: 'res-cash', label: 'Cash', type: 'number', prefix: '$' },
      { id: 'res-bank-current', label: 'Bank Current', type: 'number', prefix: '$' },
      { id: 'inc-earned', label: 'Earned Income', type: 'number', prefix: '$' },
      { id: 'perc-va', label: 'VA Benefits', type: 'number', prefix: '$' },
      { id: 'windfall-offset', label: 'Windfall Offset', type: 'text' },
      { id: 'wc-offset', label: 'WC Offset', type: 'text' },
    ]
  },
  {
    id: 'specialists-notes',
    title: 'Specialists Notes',
    icon: FileText,
    fields: [
      { id: 'specialist-notes-text', label: 'Specialist Notes', type: 'textarea', className: 'col-span-1 md:col-span-2' },
    ]
  }
];

const INITIAL_STATE: Record<string, any> = {
  'claim-type': 'T2 Only',
  'fee-status': 'Approved',
  'fee-petition': 'No',
  'perc-marital': 'Single',
  'perc-pah': 'No',
  'perc-la-type': 'A (Own household)',
  'perc-inheritance': 'No',
  'perc-wc-after-aod': 'No',
};

function ErrorFallback({error, resetErrorBoundary}: any) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 max-w-lg w-full">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle className="w-6 h-6" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
        </div>
        <p className="text-slate-600 mb-4 text-sm">An unexpected error occurred in the application.</p>
        <pre className="bg-slate-100 p-4 rounded-lg text-xs overflow-auto text-slate-800 max-h-64">
          {error.message}
        </pre>
        <button 
          onClick={resetErrorBoundary}
          className="mt-6 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium transition-colors w-full"
        >
          Reload Application
        </button>
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [data, setData] = useState<Record<string, any>>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [savedCases, setSavedCases] = useState<any[]>([]);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentNote, setCurrentNote] = useState('');

  const isAdmin = user?.email === 'rgach@ssd-sol.com';

  const handleAddNote = () => {
    if (!currentNote.trim()) return;
    const timestamp = new Date().toLocaleString();
    const activeSection = SECTIONS.find(s => s.id === activeTab);
    const sectionTitle = activeSection?.title || 'Note';
    const newNote = `[${timestamp}] ${sectionTitle}:\n${currentNote.trim()}`;
    
    setData(prev => {
      const existingNotes = prev['specialist-notes-text'] || '';
      const updatedNotes = existingNotes ? `${newNote}\n\n${existingNotes}` : newNote;
      
      const sectionNotesId = `${activeTab}-notes`;
      const existingSectionNotes = prev[sectionNotesId] || '';
      const updatedSectionNotes = existingSectionNotes ? `${newNote}\n\n${existingSectionNotes}` : newNote;
      
      return { 
        ...prev, 
        'specialist-notes-text': updatedNotes,
        [sectionNotesId]: updatedSectionNotes
      };
    });
    setCurrentNote('');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) setIsApproved(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setSavedCases([]);
      return;
    }
    
    const q = query(collection(db, `cases`), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsApproved(true);
      const cases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedCases(cases);
    }, (error) => {
      if (error.message.includes('Missing or insufficient permissions') || error.message.includes('permission_denied')) {
        setIsApproved(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, `cases`);
      }
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (isAdmin && showAdminModal) {
      const q = query(collection(db, 'allowed_users'), orderBy('addedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAllowedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'allowed_users');
      });
      return () => unsubscribe();
    }
  }, [isAdmin, showAdminModal]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !isAdmin) return;
    try {
      const email = newEmail.trim().toLowerCase();
      await setDoc(doc(db, 'allowed_users', email), {
        email,
        addedBy: user.email,
        addedAt: new Date().toISOString()
      });
      setNewEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `allowed_users/${newEmail}`);
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'allowed_users', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `allowed_users/${email}`);
    }
  };

  const handleSaveCase = async () => {
    if (!user || !isApproved) return;
    setIsSaving(true);
    try {
      const caseId = currentCaseId || crypto.randomUUID();
      const caseRef = doc(db, `cases`, caseId);
      
      const caseData = {
        ...data,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        createdAt: currentCaseId ? data.createdAt : new Date().toISOString()
      };
      
      await setDoc(caseRef, caseData);
      setCurrentCaseId(caseId);
      setData(caseData);
      alert("Case saved successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `cases`);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotals = React.useCallback((forceRecalculate: boolean = false) => {
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
    const auxNumChildren = parseInt(data['aux-num-children']) || 0;

    let t2Gross = parseFloat(data['t2-gross']) || 0;
    let shouldUpdateT2Gross = false;

    if (forceRecalculate || !data['t2-gross']) {
      if (pia > 0 && payableMonthsT2 > 0) {
        const calculatedT2Gross = pia * payableMonthsT2;
        if (t2Gross !== calculatedT2Gross) {
          t2Gross = calculatedT2Gross;
          shouldUpdateT2Gross = true;
        }
      }
    }

    const auxRetro = (fm > pia && auxNumChildren > 0) ? (fm - pia) * payableMonthsT2 : 0;
    
    let t16Gross = parseFloat(data['t16-gross']) || 0;
    let shouldUpdateT16Gross = false;

    if (forceRecalculate || !data['t16-gross']) {
      if (t16Monthly > 0 && payableMonthsT16 > 0) {
        const calculatedT16Gross = t16Monthly * payableMonthsT16;
        if (t16Gross !== calculatedT16Gross) {
          t16Gross = calculatedT16Gross;
          shouldUpdateT16Gross = true;
        }
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

      if (shouldUpdateT2Gross && prev['t2-gross'] !== format(t2Gross)) {
        updates['t2-gross'] = format(t2Gross);
      }
      if (prev['aux-retro'] !== format(auxRetro)) updates['aux-retro'] = format(auxRetro);
      if (prev['t2-retro-months'] !== String(payableMonthsT2 || '')) updates['t2-retro-months'] = String(payableMonthsT2 || '');
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
    data['t2-pia'], data['t2-fm'], data['t16-monthly'], data['t16-gross'], data['t2-gross'],
    data['fee-status'], data['fee-petition'], data['petition-amount'], data['aux-num-children']
  ]);

  // Auto-calculate fields
  useEffect(() => {
    calculateTotals(false);
  }, [calculateTotals]);

  const handleRecalculate = () => {
    calculateTotals(true);
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
- DO NOT extract any information for the "specialist-notes-text" field. This field is for manual user input only.

CROSS-REFERENCING OFFICE DIRECTORIES & LOOKUP:
You MUST look up the correct Field Office (FO) and Payment Center (PC) name, phone and fax numbers using the extracted information and put them in their respective fields:
- Field Office (ssa-fo-name, ssa-fo-phone, ssa-fo-fax): Use the claimant's ZIP code to find the local FO name, phone and fax numbers. If directories are uploaded, use them. Otherwise, use Google Search to find the SSA Field Office name, phone and fax numbers for that ZIP code.
- Payment Center (ssa-pc-name, ssa-pc-phone, ssa-pc-fax): Use the claimant's age and SSN to determine the correct Payment Center. If directories are uploaded, use them. Otherwise, use Google Search or your knowledge of SSN routing rules to find the correct PC name, phone and fax numbers.

CALCULATING BACKPAY FROM PIA & FM:
If the total gross retroactive backpay amounts are not explicitly stated, you MUST calculate them using the Primary Insurance Amount (PIA) and Family Maximum (FM):
1. Claimant base monthly = PIA (extract to "t2-pia").
2. Total monthly auxiliary pool = (FM - PIA) (extract FM to "t2-fm").
3. Determine payable months from Date of Entitlement (DOE) to Notice date.
4. "t2-gross" = (PIA * payable months).
5. "aux-retro" = ((FM - PIA) * payable months) if there are eligible dependents (extract number of children to "aux-num-children").
6. "t16-gross" = (SSI Monthly * payable months) if SSI Monthly is available.

SELECT FIELD EXACT VALUES:
  "claim-type": "T2 Only" | "T16 Only" | "Concurrent"
  "stage-approved": "Initial" | "Recon" | "Hearing" | "AC" | "Federal"
  "fee-status": "Approved" | "Denied"
  "fee-petition": "No" | "Yes"
  "perc-marital": "Single" | "Married" | "Separated" | "Divorced" | "Widowed"
  "perc-pah": "No" | "Yes"
  "perc-la-type": "A (Own household)" | "B (Another's household)" | "C (Child under 18)" | "D (Institution)" | "Transient"
  "perc-inheritance": "No" | "Yes"
  "perc-wc-after-aod": "No" | "Yes"

FIELD ID MAP:
"claim-type", "stage-approved", "cl-first", "cl-middle", "cl-last", "cl-ssn", "cl-dob", "cl-phone", "cl-address", "cl-csz", "cl-pob", "cl-mother", "cl-father", "ssa-fo-name", "ssa-fo-phone", "ssa-fo-fax", "ssa-pc-name", "ssa-pc-phone", "ssa-pc-fax", "fee-status", "fee-petition", "time-del", "reason-fee-denied", "date-petition-sent", "date-petition-app", "petition-amount", "t2-filing", "t2-aod", "t2-eod", "t2-doe", "t2-dli", "t2-pia", "t2-fm", "t2-retro-months", "t2-gross", "t2-fee-due", "t2-fee-paid", "wc-offset", "windfall-offset", "t2-wc-start", "t2-wc-stop", "t2-wc-monthly", "t2-wc-settlement", "t2-wc-left", "t2-wc-spent", "perc-marital", "perc-children", "perc-pah", "perc-family-details", "perc-la-type", "perc-expenses-total", "perc-expenses-claimant", "perc-la-changes", "res-cash", "res-bank-high", "res-bank-current", "res-vehicles", "res-other", "inc-earned", "inc-spouse", "perc-ltd", "perc-va", "perc-other-unearned", "perc-wc-start", "perc-wc-stop", "perc-wc-monthly", "perc-wc-settlement", "perc-wc-left", "perc-wc-spent", "perc-inheritance", "perc-inh-date", "perc-inh-amount", "perc-inh-left", "perc-inh-spent", "perc-wc-after-aod", "t16-pfd", "t16-eod", "t16-doe", "t16-retro-months", "t16-gross", "t16-state-repay", "t16-fee-due", "t16-fee-paid", "aux-children", "aux-num-children", "aux-retro", "aux-fee-due", "aux-fee-paid", "cdr-cease", "cdr-eod", "cdr-doe", "cdr-retro", "notice-date"`
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
              className={`w-full border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${field.readOnly ? 'bg-slate-50 cursor-not-allowed' : ''}`}
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
              className={`w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${field.readOnly ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
            />
          ) : (
            <input
              id={field.id}
              type={field.type}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              readOnly={field.readOnly}
              className={`w-full border border-slate-300 rounded-md px-3 py-2 ${field.prefix ? 'pl-8' : ''} ${field.readOnly ? 'bg-slate-50 cursor-not-allowed text-slate-600 font-medium' : 'bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
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
            <div className="bg-blue-600 p-2 rounded-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">SSD Benefits Calculator</h1>
          </div>
          
          <div className="flex items-center gap-4 print:hidden">
            <input 
              type="file" 
              multiple
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg,.csv" 
            />
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isExtracting ? 'Extracting...' : 'Upload Document(s)'}
            </button>
            <button 
              onClick={handleRecalculate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Recalculate
            </button>
            <button 
              onClick={() => {
                setData(INITIAL_STATE);
                setCurrentCaseId(null);
              }}
              className="px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-md font-medium transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            {user ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md font-medium transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Team
                  </button>
                )}
                <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full bg-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-medium text-slate-900 leading-none">{user.displayName}</p>
                    <button onClick={logOut} className="text-xs text-blue-500 hover:text-blue-700">Sign out</button>
                  </div>
                </div>
                {isApproved && (
                  <>
                    <button 
                      onClick={() => setShowLoadModal(true)}
                      className="px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-md font-medium transition-colors"
                    >
                      Load Case
                    </button>
                    <button 
                      onClick={handleSaveCase}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Case
                    </button>
                  </>
                )}
              </>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-md font-medium transition-colors"
              >
                Sign in to Save
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Quick Summary Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-10 shadow-sm print:hidden">
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
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Specialist</p>
                  <input
                    type="text"
                    value={data['specialist'] || ''}
                    onChange={(e) => handleChange('specialist', e.target.value)}
                    placeholder="Enter name"
                    className="text-sm font-medium bg-transparent border-b border-slate-300 focus:border-blue-500 focus:outline-none w-32 pb-0.5"
                  />
                </div>
                {data['fee-status'] !== 'Approved' && (
                  <div className="bg-red-50 px-3 py-1 rounded border border-red-200 flex items-center">
                    <span className="text-red-600 font-bold text-sm">Fee Petition Needed</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-blue-50 px-4 py-1.5 rounded-md border border-blue-100 flex items-center gap-3">
              <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Total Fee Due</p>
              <p className="text-base font-mono font-bold text-blue-700">
                ${((parseFloat(data['t2-fee-due']) || 0) + (parseFloat(data['t16-fee-due']) || 0) + (parseFloat(data['aux-fee-due']) || 0)).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user && isApproved === false && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-amber-900 mb-2">Access Pending</h2>
            <p className="text-amber-700 max-w-md mx-auto">
              Your email ({user.email}) has not been approved to access the shared workspace yet. Please contact your administrator to be added to the approved users list.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Error extracting data</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className={`flex flex-col md:flex-row gap-8 ${user && isApproved === false ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0 print:hidden">
            <nav className="flex flex-col gap-1">
              {SECTIONS.map(section => {
                const Icon = section.icon;
                const isActive = activeTab === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveTab(section.id);
                      setCurrentNote('');
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
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
                  {activeSection?.fields.map(field => {
                    if (field.visible && !field.visible(data)) return null;
                    return (
                      <div key={field.id} className={field.type === 'textarea' ? 'col-span-1 md:col-span-2 lg:col-span-3' : (field.className || '')}>
                        {renderField(field)}
                      </div>
                    );
                  })}
                </div>

                {activeSection?.id !== 'specialists-notes' && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-medium text-slate-700 mb-3">Notes</h3>
                    <div className="flex flex-col gap-3">
                      {data[`${activeSection?.id}-notes`] && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm whitespace-pre-wrap text-slate-700">
                          {data[`${activeSection?.id}-notes`]}
                        </div>
                      )}
                      <textarea
                        value={currentNote}
                        onChange={(e) => setCurrentNote(e.target.value)}
                        placeholder={`Add a note about ${activeSection?.title}...`}
                        rows={3}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddNote}
                          disabled={!currentNote.trim()}
                          className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium transition-colors disabled:opacity-50"
                        >
                          Add Note
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">Load Saved Case</h2>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name or SSN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {savedCases.filter(c => 
                (c['cl-first']?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c['cl-last']?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c['cl-ssn']?.includes(searchQuery))
              ).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No saved cases found.</p>
              ) : (
                savedCases.filter(c => 
                  (c['cl-first']?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  (c['cl-last']?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  (c['cl-ssn']?.includes(searchQuery))
                ).map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setData(c);
                        setCurrentCaseId(c.id);
                        setShowLoadModal(false);
                      }}
                      className="flex-1 text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-medium text-slate-900">
                        {c['cl-first'] || 'Unknown'} {c['cl-last'] || 'Claimant'} {c['cl-ssn'] ? `(${c['cl-ssn']})` : ''}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Updated: {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCaseToDelete(c.id);
                      }}
                      className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent transition-colors"
                      title="Delete Case"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 text-blue-600 hover:bg-blue-200 bg-blue-100 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Case?</h3>
            <p className="text-slate-600 mb-6 text-sm">Are you sure you want to delete this case? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCaseToDelete(null)}
                className="px-4 py-2 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user) return;
                  try {
                    await deleteDoc(doc(db, `cases`, caseToDelete));
                    if (currentCaseId === caseToDelete) {
                      setData(INITIAL_STATE);
                      setCurrentCaseId(null);
                    }
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `cases/${caseToDelete}`);
                  } finally {
                    setCaseToDelete(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">Manage Team Access</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-blue-400 hover:text-blue-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200">
              <form onSubmit={handleAddUser} className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </form>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              <h3 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">Authorized Users</h3>
              {allowedUsers.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No other users authorized yet.</p>
              ) : (
                allowedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <div className="font-medium text-slate-900">{u.email}</div>
                      <div className="text-xs text-slate-500">Added: {new Date(u.addedAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'allowed_users', u.id));
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `allowed_users/${u.id}`);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Remove Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
