
import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CompanyProfile, PotentialClient, OutreachMaterials, HistoryLog, SentEmail } from './types';
import * as geminiService from './services/geminiService';
import { 
    NexaLogo, SparklesIcon, BuildingOfficeIcon, CloudArrowDownIcon, 
    PaperAirplaneIcon, ArchiveBoxIcon, ChartPieIcon, 
    UserCircleIcon, ClockIcon, PlusIcon, CheckCircleIcon,
    FunnelIcon, LayoutDashboardIcon, EnvelopeIcon, PencilSquareIcon,
    CogIcon, ArrowDownTrayIcon
} from './components/icons';

// --- Components ---

const SkeletonCard = () => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-gray-800 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-800 rounded w-1/4"></div>
    </div>
);

const MultiSelectInput = ({ label, placeholder, values, onChange, disabled = false }: any) => {
    const [input, setInput] = useState('');
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            if (!values.includes(input.trim())) onChange([...values, input.trim()]);
            setInput('');
        }
    };
    const removeValue = (val: string) => onChange(values.filter((v: string) => v !== val));

    return (
        <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">{label}</label>
            <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {values.map((val: string) => (
                    <span key={val} className="bg-indigo-900/50 text-indigo-200 text-xs px-2 py-1 rounded-md flex items-center gap-1 border border-indigo-500/30">
                        {val} <button type="button" onClick={() => removeValue(val)} className="hover:text-white font-bold">&times;</button>
                    </span>
                ))}
                <input 
                    type="text" className="bg-transparent outline-none text-gray-200 text-sm flex-1 min-w-[100px]"
                    placeholder={values.length === 0 ? placeholder : ''}
                    value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={disabled}
                />
            </div>
        </div>
    );
};

const Spinner = ({text = ''}: {text?: string}) => (
    <div className="flex items-center space-x-2 text-indigo-400 justify-center">
      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text && <span className="text-sm font-medium animate-pulse">{text}</span>}
    </div>
);

// --- Main App ---

export default function App() {
    const [appState, setAppState] = useState<'splash' | 'setup' | 'dashboard'>('splash');
    const [view, setView] = useState<'leads' | 'mail' | 'analytics' | 'history' | 'profile'>('leads');
    
    // Data State
    const [profile, setProfile] = useState<CompanyProfile>({
        companyName: '', description: '', contactEmail: '', location: { country: '', regions: [], cities: [] }, targetIndustries: []
    });
    // Temporary state for editing profile
    const [editProfile, setEditProfile] = useState<CompanyProfile | null>(null);

    const [clients, setClients] = useState<PotentialClient[]>([]);
    const [history, setHistory] = useState<HistoryLog[]>([]);
    const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [selectedClient, setSelectedClient] = useState<PotentialClient | null>(null);
    const [generatedMaterials, setGeneratedMaterials] = useState<OutreachMaterials | null>(null);
    const [activeTab, setActiveTab] = useState<'email' | 'portfolio'>('email');

    // Mail Section State
    const [mailTab, setMailTab] = useState<'inbox' | 'compose'>('inbox');
    const [customEmailTo, setCustomEmailTo] = useState('');
    const [customEmailSubject, setCustomEmailSubject] = useState('');
    const [customEmailBody, setCustomEmailBody] = useState('');

    // Strategy
    const [strategy, setStrategy] = useState<{ title: string, content: string }[] | null>(null);

    const portfolioRef = useRef<HTMLDivElement>(null);

    // Initialization
    useEffect(() => { 
        setTimeout(() => {
            const stored = localStorage.getItem('nexa_data');
            if (stored) {
                const data = JSON.parse(stored);
                setProfile(data.profile || profile);
                setClients(data.clients || []);
                setHistory(data.history || []);
                setSentEmails(data.sentEmails || []);
                if (data.strategy) setStrategy(data.strategy);
                setAppState('dashboard');
            } else {
                setAppState('setup');
            }
        }, 1500); 
    }, []);

    // Auto-save
    useEffect(() => {
        if (appState === 'dashboard') {
            localStorage.setItem('nexa_data', JSON.stringify({ profile, clients, history, sentEmails, strategy }));
        }
    }, [profile, clients, history, sentEmails, strategy, appState]);

    // Initialize edit profile state when entering profile view
    useEffect(() => {
        if (view === 'profile') {
            setEditProfile({...profile});
        }
    }, [view, profile]);

    // Auto-fetch leads on first dashboard load
    useEffect(() => {
        if (appState === 'dashboard' && clients.length === 0 && !isGenerating) {
            handleGenerateClients();
        }
    }, [appState]);

    const handleGenerateClients = async () => {
        setIsGenerating(true);
        try {
            const result = await geminiService.findPotentialClients(profile, clients);
            if (result.found) {
                setClients(prev => [...prev, ...result.clients]);
                addHistoryLog(`Found ${result.clients.length} new leads`, 'sparkles');
            } else {
                addHistoryLog('No clients found in target location.', 'sparkles');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateMaterials = async (client: PotentialClient) => {
        setSelectedClient(client);
        setGeneratedMaterials(null);
        setIsGenerating(true);
        setActiveTab('email');
        try {
            const [email, portfolio] = await Promise.all([
                geminiService.generateOutreachEmail(profile, client),
                geminiService.createPortfolioContent(profile, client)
            ]);
            setGeneratedMaterials({ email, portfolio });
            addHistoryLog(`Generated materials for ${client.companyName}`, 'sparkles');
        } catch (error) {
            alert("Failed to generate materials.");
        } finally {
            setIsGenerating(false);
        }
    };

    const addHistoryLog = (message: string, icon: HistoryLog['icon']) => {
        setHistory(prev => [{
            id: Date.now(),
            message,
            timestamp: new Date().toLocaleTimeString(),
            icon
        }, ...prev]);
    };

    const handleGenerateStrategy = async () => {
        setIsGenerating(true);
        try {
            const result = await geminiService.generateBusinessStrategy(profile);
            setStrategy(result.tips);
            addHistoryLog('Generated new business strategy', 'lightbulb');
        } catch (e) {
            alert('Failed to generate strategy');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPortfolio = async () => {
        if (!portfolioRef.current) return;
        try {
            const element = portfolioRef.current;
            // Clone and set strict dimensions for PDF generation
            const pdfContainer = document.createElement('div');
            pdfContainer.style.position = 'fixed';
            pdfContainer.style.top = '-10000px';
            pdfContainer.style.left = '0';
            pdfContainer.style.width = '794px'; 
            pdfContainer.style.height = '1123px';
            pdfContainer.style.background = 'white';
            pdfContainer.style.color = 'black';
            pdfContainer.style.fontFamily = 'Arial, sans-serif';
            pdfContainer.appendChild(element.cloneNode(true));
            document.body.appendChild(pdfContainer);

            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            document.body.removeChild(pdfContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' });
            
            pdf.addImage(imgData, 'PNG', 0, 0, 446, 631); // 446x631 is approx A4 in px at 72dpi, but let's trust jsPDF fit
            // Better approach for A4 full page image
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            pdf.save(`${selectedClient?.companyName || 'Portfolio'}.pdf`);
            addHistoryLog(`Downloaded portfolio PDF`, 'archive');
            return true;
        } catch (e) {
            alert('Failed to download PDF');
            return false;
        }
    };

    const handleDownloadHistory = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text("Activity History Report", 20, 20);
            doc.setFontSize(12);
            let y = 40;
            history.forEach((log) => {
                const text = `${log.timestamp} - ${log.message}`;
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(text, 20, y);
                y += 10;
            });
            doc.save("Nexa_History_Report.pdf");
            addHistoryLog(`Downloaded history report`, 'archive');
        } catch(e) {
            alert("Failed to generate PDF");
        }
    };

    const handleExportLeads = () => {
        if (clients.length === 0) return;
        const headers = ["Company Name", "Contact Name", "Email", "Description", "Industry", "Status"];
        const rows = clients.map(c => [
            c.companyName, 
            c.contactName, 
            c.contactEmail, 
            `"${c.description.replace(/"/g, '""')}"`, 
            c.industry, 
            c.status
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "nexa_leads.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addHistoryLog(`Exported ${clients.length} leads to CSV`, 'archive');
    };

    const handleSendEmail = async () => {
        if (!selectedClient || !generatedMaterials) return;
        setIsSending(true);
        try {
            // 1. Download PDF so user can attach it
            await handleDownloadPortfolio();
            
            // 2. Open Gmail in new tab
            const subject = encodeURIComponent(generatedMaterials.email.subject);
            const body = encodeURIComponent(generatedMaterials.email.body);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${selectedClient.contactEmail}&su=${subject}&body=${body}`;
            
            window.open(gmailUrl, '_blank');
            
            setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, status: 'Emailed' } : c));
            
            // Record in sent box
            setSentEmails(prev => [{
                id: `sent_${Date.now()}`,
                to: selectedClient.contactEmail,
                subject: generatedMaterials.email.subject,
                body: generatedMaterials.email.body,
                timestamp: new Date().toLocaleString(),
                from: profile.contactEmail
            }, ...prev]);

            addHistoryLog(`Opened Gmail draft for ${selectedClient.companyName}`, 'airplane');
            setActiveTab('email'); 
            alert(`Draft opened in Gmail!\n\nPlease drag and drop the downloaded Portfolio PDF into the email attachment area.`);
        } catch (e) {
            alert('Failed to initiate email.');
        } finally {
            setIsSending(false);
        }
    };

    const handleSendCustomEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customEmailTo || !customEmailSubject || !customEmailBody) return;
        setIsSending(true);
        try {
            // Open Gmail for custom email too
            const subject = encodeURIComponent(customEmailSubject);
            const body = encodeURIComponent(customEmailBody);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${customEmailTo}&su=${subject}&body=${body}`;
            window.open(gmailUrl, '_blank');

            setSentEmails(prev => [{
                id: `sent_${Date.now()}`,
                to: customEmailTo,
                subject: customEmailSubject,
                body: customEmailBody,
                timestamp: new Date().toLocaleString(),
                from: profile.contactEmail
            }, ...prev]);

            addHistoryLog(`Opened Gmail draft to ${customEmailTo}`, 'mail');
            setCustomEmailTo('');
            setCustomEmailSubject('');
            setCustomEmailBody('');
            setMailTab('inbox');
        } catch (e) {
            alert('Failed to send email.');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        if(editProfile) {
            setProfile(editProfile);
            setClients([]); // Clear old leads
            setStrategy(null); // Clear old strategy
            setAppState('dashboard');
            setView('leads');
            handleGenerateClients(); // Trigger fresh generation
            addHistoryLog('Profile updated. Refreshing leads...', 'sparkles');
        }
    };

    // --- Analytics View ---
    const AnalyticsDashboard = () => {
        const total = clients.length;
        const emailed = clients.filter(c => c.status === 'Emailed' || c.status === 'Replied').length;
        
        const industries = clients.reduce((acc, curr) => {
            acc[curr.industry] = (acc[curr.industry] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const topIndustries = Object.entries(industries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        return (
            <div className="p-8 h-full overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6">Performance Analytics</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Total Leads Generated</div>
                        <div className="text-4xl font-bold text-white">{total}</div>
                        <div className="text-green-500 text-xs mt-2 flex items-center gap-1"><PlusIcon className="w-3 h-3"/> Based on your profile</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Proposals Initiated</div>
                        <div className="text-4xl font-bold text-indigo-400">{emailed}</div>
                        <div className="text-gray-500 text-xs mt-2">{total > 0 ? Math.round((emailed/total)*100) : 0}% Coverage</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <div className="text-gray-400 text-sm mb-1">Estimated Conversion</div>
                        <div className="text-4xl font-bold text-green-400">{emailed > 0 ? '4-8%' : '0%'}</div>
                        <div className="text-gray-500 text-xs mt-2">Industry Average</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-semibold flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-indigo-500"/> AI Strategy Builder</h3>
                            {!strategy && <button onClick={handleGenerateStrategy} disabled={isGenerating} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">{isGenerating ? 'Analyzing...' : 'Generate Strategy'}</button>}
                            {strategy && <button onClick={handleGenerateStrategy} disabled={isGenerating} className="text-xs text-indigo-400 hover:text-white transition-colors">Regenerate</button>}
                        </div>
                        
                        {!strategy ? (
                            <div className="text-center py-10 text-gray-500 bg-gray-950/50 rounded-xl border border-dashed border-gray-800">
                                <p>Get AI-powered tips to grow your business based on your profile.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {strategy.map((tip, idx) => (
                                    <div key={idx} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                        <div className="w-8 h-8 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold mb-3">{idx+1}</div>
                                        <h4 className="font-bold text-gray-200 mb-2">{tip.title}</h4>
                                        <p className="text-sm text-gray-400 leading-relaxed">{tip.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col">
                         <h3 className="font-semibold mb-4 flex items-center gap-2"><ClockIcon className="w-5 h-5 text-indigo-500"/> Recent Activity</h3>
                         <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-64">
                            {history.length > 0 ? history.slice(0, 10).map(log => (
                                <div key={log.id} className="text-sm flex gap-3 pb-2 border-b border-gray-800/50 last:border-0">
                                    <div className="mt-1 text-indigo-500">
                                        {log.icon === 'lightbulb' ? <SparklesIcon className="w-3 h-3"/> : <ClockIcon className="w-3 h-3"/>}
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-gray-300">{log.message}</span>
                                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                                    </div>
                                </div>
                            )) : <div className="text-gray-500 text-sm">No activity yet</div>}
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- Render Logic ---

    if (appState === 'splash') return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950">
            <div className="animate-pulse"><NexaLogo className="text-7xl" /></div>
            <p className="mt-4 text-xl text-indigo-400 font-light tracking-widest">INTELLIGENT MARKETING</p>
        </div>
    );

    if (appState === 'setup') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950 font-sans">
                <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-6 relative z-10">
                        <NexaLogo className="text-4xl" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">Setup Profile</h2>
                            <p className="text-gray-400 text-sm">Tell AI about your business to find the perfect clients.</p>
                        </div>
                    </div>
                    
                    <form onSubmit={(e) => { e.preventDefault(); setAppState('dashboard'); }} className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Company Name (Optional)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none focus:border-indigo-500 transition-all placeholder-gray-600" 
                                    placeholder="e.g. Acme Studio"
                                    value={profile.companyName} 
                                    onChange={e => setProfile({...profile, companyName: e.target.value})} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Company Description</label>
                                <textarea 
                                    required 
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none h-32 resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600" 
                                    placeholder="e.g. We are a digital design agency specializing in branding for eco-friendly startups..." 
                                    value={profile.description} 
                                    onChange={e => setProfile({...profile, description: e.target.value})} 
                                />
                            </div>
                            <MultiSelectInput 
                                label="Target Industries" 
                                placeholder="Type & Enter (e.g. SaaS, Retail)" 
                                values={profile.targetIndustries} 
                                onChange={(v: string[]) => setProfile({...profile, targetIndustries: v})} 
                            />
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Primary Location</label>
                                <select 
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-indigo-500 transition-all appearance-none" 
                                    value={profile.location.country} 
                                    onChange={e => setProfile({...profile, location: {...profile.location, country: e.target.value, regions: [], cities: []}})}
                                >
                                    <option value="">Select Country</option>
                                    {["United States", "United Kingdom", "Canada", "India", "Australia", "Germany", "France"].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <MultiSelectInput 
                                    label="Regions (Optional)" 
                                    placeholder="State/Province" 
                                    values={profile.location.regions} 
                                    onChange={(v: string[]) => setProfile({...profile, location: {...profile.location, regions: v}})} 
                                    disabled={!profile.location.country} 
                                />
                                <MultiSelectInput 
                                    label="Cities (Optional)" 
                                    placeholder="Specific City" 
                                    values={profile.location.cities} 
                                    onChange={(v: string[]) => setProfile({...profile, location: {...profile.location, cities: v}})} 
                                    disabled={!profile.location.country} 
                                />
                            </div>

                            <div>
                                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Contact Email (Sender)</label>
                                <input 
                                    type="email" 
                                    required 
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none focus:border-indigo-500 transition-all placeholder-gray-600" 
                                    placeholder="contact@yourcompany.com"
                                    value={profile.contactEmail} 
                                    onChange={e => setProfile({...profile, contactEmail: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-2 pt-4">
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-[0.99] transition-all flex items-center justify-center gap-3">
                                <SparklesIcon className="w-6 h-6"/> Launch & Find Clients
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-950 overflow-hidden text-gray-200 font-sans selection:bg-indigo-500/30">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-20">
                <div className="p-6 border-b border-gray-800">
                    <NexaLogo className="text-2xl origin-left" />
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <button onClick={() => setView('leads')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'leads' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><UserCircleIcon className="w-5 h-5"/> Leads</button>
                    <button onClick={() => setView('mail')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'mail' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><EnvelopeIcon className="w-5 h-5"/> Mail</button>
                    <button onClick={() => setView('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><ChartPieIcon className="w-5 h-5"/> Analytics</button>
                    <button onClick={() => setView('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><ClockIcon className="w-5 h-5"/> History</button>
                    <button onClick={() => setView('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><CogIcon className="w-5 h-5"/> Profile</button>
                </nav>
                <div className="p-4 border-t border-gray-800 bg-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">
                            {profile.description.substring(0,2).toUpperCase() || "ME"}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{profile.companyName || 'My Company'}</p>
                            <p className="text-xs text-gray-500 truncate">{profile.contactEmail || "Setup Required"}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-950">
                <header className="h-16 bg-gray-900/50 backdrop-blur border-b border-gray-800 flex items-center justify-between px-8 shrink-0 z-10">
                    <h1 className="text-lg font-semibold text-gray-100 capitalize flex items-center gap-2">
                        {view === 'leads' && <LayoutDashboardIcon className="text-indigo-500"/>}
                        {view === 'mail' && <EnvelopeIcon className="text-indigo-500"/>}
                        {view === 'analytics' && <ChartPieIcon className="text-indigo-500"/>}
                        {view === 'history' && <ClockIcon className="text-indigo-500"/>}
                        {view === 'profile' && <CogIcon className="text-indigo-500"/>}
                        {view === 'leads' ? 'Client Discovery' : view.charAt(0).toUpperCase() + view.slice(1)}
                    </h1>
                    <div className="flex items-center gap-2">
                        {isGenerating && <span className="text-xs text-indigo-400 animate-pulse font-medium">AI is working...</span>}
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative">
                    {view === 'analytics' && <AnalyticsDashboard />}
                    
                    {view === 'history' && (
                        <div className="p-8 max-w-3xl mx-auto space-y-4 overflow-y-auto h-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">Action History</h2>
                                {history.length > 0 && (
                                    <button onClick={handleDownloadHistory} className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                                        <ArrowDownTrayIcon className="w-4 h-4"/> Download Report
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-4">
                                {history.length === 0 && <p className="text-gray-500">No history logged yet.</p>}
                                {history.map(log => (
                                    <div key={log.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center gap-4 hover:border-gray-700 transition-colors">
                                        <div className="p-3 bg-gray-800 rounded-full text-indigo-400 shadow-inner">
                                            {log.icon === 'sparkles' && <SparklesIcon/>}
                                            {log.icon === 'airplane' && <PaperAirplaneIcon/>}
                                            {log.icon === 'check' && <CheckCircleIcon/>}
                                            {log.icon === 'clock' && <ClockIcon/>}
                                            {log.icon === 'archive' && <ArchiveBoxIcon/>}
                                            {log.icon === 'mail' && <EnvelopeIcon/>}
                                            {log.icon === 'lightbulb' && <SparklesIcon/>}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-gray-200 font-medium">{log.message}</p>
                                            <p className="text-xs text-gray-500 font-mono mt-1">{log.timestamp}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'profile' && editProfile && (
                        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold">Edit Profile & Preferences</h2>
                                <p className="text-sm text-yellow-500 bg-yellow-900/20 px-3 py-1 rounded border border-yellow-700/50">Saving will refresh client leads.</p>
                            </div>

                            <form onSubmit={handleSaveProfile} className="space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Business Details</h3>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Company Name</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none focus:border-indigo-500 transition-all placeholder-gray-600" 
                                            value={editProfile.companyName} 
                                            onChange={e => setEditProfile({...editProfile, companyName: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Company Description</label>
                                        <textarea 
                                            required 
                                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none h-32 resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600" 
                                            value={editProfile.description} 
                                            onChange={e => setEditProfile({...editProfile, description: e.target.value})} 
                                        />
                                    </div>
                                    <MultiSelectInput 
                                        label="Target Industries" 
                                        placeholder="Type & Enter (e.g. SaaS, Retail)" 
                                        values={editProfile.targetIndustries} 
                                        onChange={(v: string[]) => setEditProfile({...editProfile, targetIndustries: v})} 
                                    />
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Location Strategy</h3>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Primary Location</label>
                                        <select 
                                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-indigo-500 transition-all appearance-none" 
                                            value={editProfile.location.country} 
                                            onChange={e => setEditProfile({...editProfile, location: {...editProfile.location, country: e.target.value, regions: [], cities: []}})}
                                        >
                                            <option value="">Select Country</option>
                                            {["United States", "United Kingdom", "Canada", "India", "Australia", "Germany", "France"].map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <MultiSelectInput 
                                            label="Regions (Optional)" 
                                            placeholder="State/Province" 
                                            values={editProfile.location.regions} 
                                            onChange={(v: string[]) => setEditProfile({...editProfile, location: {...editProfile.location, regions: v}})} 
                                            disabled={!editProfile.location.country} 
                                        />
                                        <MultiSelectInput 
                                            label="Cities (Optional)" 
                                            placeholder="Specific City" 
                                            values={editProfile.location.cities} 
                                            onChange={(v: string[]) => setEditProfile({...editProfile, location: {...editProfile.location, cities: v}})} 
                                            disabled={!editProfile.location.country} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Communication</h3>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">Contact Email (Sender)</label>
                                        <input 
                                            type="email" 
                                            required 
                                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-200 outline-none focus:border-indigo-500 transition-all placeholder-gray-600" 
                                            value={editProfile.contactEmail} 
                                            onChange={e => setEditProfile({...editProfile, contactEmail: e.target.value})} 
                                        />
                                        <p className="text-xs text-gray-500 mt-2">All outgoing emails will appear to come from this address.</p>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3">
                                        <CheckCircleIcon className="w-5 h-5"/> Save & Refresh Leads
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {view === 'mail' && (
                        <div className="flex h-full">
                            <div className="w-64 border-r border-gray-800 bg-gray-900/30 flex flex-col">
                                <button onClick={() => setMailTab('inbox')} className={`p-4 text-left font-medium border-b border-gray-800 hover:bg-gray-800 transition-colors ${mailTab === 'inbox' ? 'text-white bg-gray-800' : 'text-gray-400'}`}>
                                    Sent Items
                                </button>
                                <button onClick={() => setMailTab('compose')} className={`p-4 text-left font-medium border-b border-gray-800 hover:bg-gray-800 transition-colors flex items-center gap-2 ${mailTab === 'compose' ? 'text-white bg-gray-800' : 'text-gray-400'}`}>
                                    <PencilSquareIcon className="w-5 h-5"/> Compose New
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8">
                                {mailTab === 'inbox' && (
                                    <div className="max-w-4xl mx-auto">
                                        <h2 className="text-2xl font-bold mb-6">Sent Emails</h2>
                                        {sentEmails.length === 0 && <p className="text-gray-500">No emails sent yet.</p>}
                                        <div className="space-y-4">
                                            {sentEmails.map(email => (
                                                <div key={email.id} className="bg-gray-900 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-lg font-bold text-white">{email.subject}</h3>
                                                        <span className="text-xs text-gray-500">{email.timestamp}</span>
                                                    </div>
                                                    <p className="text-sm text-indigo-400 mb-2">To: {email.to}</p>
                                                    <div className="bg-gray-800/50 p-4 rounded-lg text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                                        {email.body.length > 200 ? email.body.substring(0, 200) + '...' : email.body}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {mailTab === 'compose' && (
                                    <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
                                        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                                            <h3 className="font-bold text-gray-200">New Message</h3>
                                        </div>
                                        <form onSubmit={handleSendCustomEmail} className="p-6 space-y-4">
                                            <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
                                                <label className="w-16 text-gray-400 font-medium text-sm">To</label>
                                                <input required type="email" value={customEmailTo} onChange={e => setCustomEmailTo(e.target.value)} className="flex-1 bg-transparent text-white outline-none placeholder-gray-600" placeholder="recipient@example.com"/>
                                            </div>
                                            <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
                                                <label className="w-16 text-gray-400 font-medium text-sm">From</label>
                                                <input type="text" value={profile.contactEmail} disabled className="flex-1 bg-transparent text-gray-500 cursor-not-allowed outline-none"/>
                                            </div>
                                            <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
                                                <label className="w-16 text-gray-400 font-medium text-sm">Subject</label>
                                                <input required type="text" value={customEmailSubject} onChange={e => setCustomEmailSubject(e.target.value)} className="flex-1 bg-transparent text-white outline-none placeholder-gray-600" placeholder="Subject"/>
                                            </div>
                                            <div className="pt-2">
                                                <textarea required value={customEmailBody} onChange={e => setCustomEmailBody(e.target.value)} className="w-full bg-transparent text-gray-200 outline-none h-64 resize-none leading-relaxed" placeholder="Write your message..."/>
                                            </div>
                                            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                                                <div className="text-xs text-gray-500">Formatting options unavailable in plain text mode.</div>
                                                <button type="submit" disabled={isSending} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2 transition-colors">
                                                    {isSending ? <Spinner text="Opening..."/> : <><PaperAirplaneIcon className="w-4 h-4"/> Open in Gmail</>}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'leads' && (
                        <div className="flex h-full">
                            {/* Lead List */}
                            <div className="w-[400px] border-r border-gray-800 flex flex-col bg-gray-900/30 relative">
                                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Potential Clients</span>
                                    {clients.length > 0 && (
                                        <button onClick={handleExportLeads} className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                                            <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                                    {isGenerating && clients.length === 0 && Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                                    {clients.length === 0 && !isGenerating && (
                                        <div className="text-center p-10 text-gray-500">
                                            <SparklesIcon className="w-10 h-10 mx-auto mb-3 opacity-20"/>
                                            <p>No clients yet.</p>
                                        </div>
                                    )}
                                    {clients.map(client => (
                                        <div 
                                            key={client.id} 
                                            onClick={() => { setSelectedClient(client); if(selectedClient?.id !== client.id) setGeneratedMaterials(null); }} 
                                            className={`border rounded-xl p-4 cursor-pointer transition-all ${selectedClient?.id === client.id ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-gray-200 text-sm">{client.companyName}</h3>
                                                {client.status === 'Emailed' && <CheckCircleIcon className="w-4 h-4 text-green-500"/>}
                                            </div>
                                            <p className="text-xs text-gray-400 line-clamp-2">{client.description}</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold tracking-wider bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">{client.industry}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Floating Plus Button at bottom left corner of sidebar */}
                                <div className="absolute bottom-6 left-6 z-20">
                                    <button 
                                        onClick={() => handleGenerateClients()} 
                                        disabled={isGenerating} 
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white w-14 h-14 rounded-full shadow-lg shadow-indigo-900/50 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                                        title="Find More Clients"
                                    >
                                        {isGenerating ? <Spinner/> : <PlusIcon className="w-8 h-8"/>}
                                    </button>
                                </div>
                            </div>

                            {/* Detail View */}
                            <div className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden">
                                {selectedClient ? (
                                    <>
                                        <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center z-10">
                                            <div>
                                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                                    {selectedClient.companyName}
                                                    {selectedClient.status === 'Emailed' && <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full border border-green-800">Contacted</span>}
                                                </h2>
                                                <div className="flex gap-4 mt-1 text-sm text-gray-400">
                                                    <span className="flex items-center gap-1"><UserCircleIcon className="w-4 h-4"/> {selectedClient.contactName}</span>
                                                    <span className="flex items-center gap-1 opacity-70">|</span>
                                                    <span className="text-indigo-400">{selectedClient.contactEmail}</span>
                                                </div>
                                            </div>
                                            {!generatedMaterials && (
                                                <button onClick={() => handleGenerateMaterials(selectedClient)} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-900/50 flex items-center gap-2">
                                                    {isGenerating ? <Spinner/> : <><SparklesIcon className="w-5 h-5"/> Generate Strategy</>}
                                                </button>
                                            )}
                                            {generatedMaterials && (
                                                 <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
                                                    <button onClick={() => setActiveTab('email')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'email' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Email Proposal</button>
                                                    <button onClick={() => setActiveTab('portfolio')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'portfolio' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Portfolio PDF</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-8 relative">
                                            {!generatedMaterials ? (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                                                    <SparklesIcon className="w-16 h-16 mb-4"/>
                                                    <p>Generate a strategy to start outreach</p>
                                                </div>
                                            ) : (
                                                <div className="max-w-4xl mx-auto animate-fadeIn">
                                                    {activeTab === 'email' && (
                                                        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                                            <div className="bg-gray-800 px-6 py-3 border-b border-gray-700 flex justify-between items-center">
                                                                <span className="text-sm font-semibold text-gray-300">Draft Email</span>
                                                                <span className="text-xs text-gray-500">From: {profile.contactEmail}</span>
                                                            </div>
                                                            <div className="p-8 space-y-6">
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
                                                                    <input readOnly value={generatedMaterials.email.subject} className="w-full bg-transparent border-b border-gray-700 py-2 text-lg text-white outline-none"/>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase">Message</label>
                                                                    <textarea readOnly value={generatedMaterials.email.body} className="w-full bg-transparent border-none text-gray-300 outline-none h-64 resize-none leading-relaxed text-base" />
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-3 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                                                                    <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">PDF</div>
                                                                    <span className="text-sm text-indigo-200 font-medium">To be attached: {selectedClient.companyName}_Portfolio.pdf</span>
                                                                </div>

                                                                <div className="flex justify-end pt-4 border-t border-gray-800">
                                                                    <button 
                                                                        onClick={handleSendEmail} 
                                                                        disabled={isSending || selectedClient.status === 'Emailed'}
                                                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                                                                    >
                                                                        {isSending ? <Spinner text="Processing..."/> : (
                                                                            selectedClient.status === 'Emailed' ? <><CheckCircleIcon className="w-5 h-5"/> Opened in Gmail</> : <><PaperAirplaneIcon className="w-5 h-5"/> Open Gmail & Attach PDF</>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeTab === 'portfolio' && (
                                                        <div className="flex flex-col items-center">
                                                             <div className="mb-6 w-full flex justify-end max-w-[794px]">
                                                                <button onClick={handleDownloadPortfolio} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow">
                                                                    <ArrowDownTrayIcon className="w-4 h-4"/> Download PDF
                                                                </button>
                                                            </div>
                                                            <div className="flex justify-center w-full overflow-hidden">
                                                                {/* Hidden rendering container reference */}
                                                                <div ref={portfolioRef} className="bg-white text-gray-900 shadow-2xl relative" style={{width: '794px', height: '1123px', flexShrink: 0, overflow: 'hidden'}}>
                                                                    {/* Portfolio Header / Cover */}
                                                                    <div className="bg-gray-900 text-white p-16 relative overflow-hidden">
                                                                        <div className="relative z-10">
                                                                            <h1 className="text-5xl font-bold mb-4 tracking-tight leading-tight">{generatedMaterials.portfolio.title}</h1>
                                                                            <div className="w-20 h-2 bg-indigo-500 mb-8"></div>
                                                                            <p className="text-xl text-gray-300 max-w-lg">{generatedMaterials.portfolio.introduction}</p>
                                                                        </div>
                                                                        <div className="absolute top-0 right-0 w-64 h-full bg-indigo-600 opacity-20 transform skew-x-12 translate-x-20"></div>
                                                                    </div>

                                                                    {/* Body Content */}
                                                                    <div className="p-16">
                                                                        <div className="mb-12">
                                                                            <h2 className="text-2xl font-bold text-gray-900 mb-6 uppercase tracking-wider border-b-2 border-gray-200 pb-2">Proposed Solutions</h2>
                                                                            <div className="grid gap-8">
                                                                                {generatedMaterials.portfolio.services.map((s, i) => (
                                                                                    <div key={i} className="flex gap-4">
                                                                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl rounded-full shrink-0">0{i+1}</div>
                                                                                        <div>
                                                                                            <h3 className="font-bold text-lg mb-2">{s.name}</h3>
                                                                                            <p className="text-gray-600 leading-relaxed text-sm">{s.description}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        <div className="mb-12 p-8 bg-gray-50 rounded-xl border border-gray-100">
                                                                            <h2 className="text-xl font-bold mb-4">Design Strategy</h2>
                                                                            <div className="flex gap-8">
                                                                                 <div>
                                                                                     <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Color Palette</span>
                                                                                     <span className="block text-lg font-medium">{generatedMaterials.portfolio.designTheme.palette}</span>
                                                                                 </div>
                                                                                 <div>
                                                                                     <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Typography</span>
                                                                                     <span className="block text-lg font-medium">{generatedMaterials.portfolio.designTheme.fontStyle}</span>
                                                                                 </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="text-center mt-12 p-8 border-t border-gray-200">
                                                                             <h3 className="text-2xl font-bold text-indigo-900 mb-2">Ready to Start?</h3>
                                                                             <p className="text-gray-600 mb-4">{generatedMaterials.portfolio.callToAction}</p>
                                                                             <div className="inline-block bg-gray-900 text-white px-8 py-3 rounded-full font-bold">Contact: {profile.contactEmail}</div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Footer */}
                                                                    <div className="absolute bottom-0 w-full p-8 text-center text-gray-400 text-sm border-t">
                                                                        Prepared exclusively for {selectedClient.companyName} by {profile.companyName || profile.description.substring(0,20)}...
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                                        <BuildingOfficeIcon className="w-24 h-24 mb-4 opacity-50"/>
                                        <p className="text-lg">Select a potential client to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
