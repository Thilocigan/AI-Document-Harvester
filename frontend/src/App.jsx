import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import ProgressBar from './components/ProgressBar';
import PDFPreviewGrid from './components/PDFPreviewGrid';
import MasterDownloadHub from './components/MasterDownloadHub';
import RAGChatSidebar from './components/RAGChatSidebar';
import PDFModal from './components/PDFModal';
import SettingsModal from './components/SettingsModal';
import PDFPageOrganizerModal from './components/PDFPageOrganizerModal';
import CommercialHarvesterModal from './components/CommercialHarvesterModal';

export default function App() {
  const [targetUrl, setTargetUrl] = useState('https://demo.enterprise-intelligence.org');
  const [depthLevel, setDepthLevel] = useState('single');
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState({
    status: 'idle',
    current_phase: 0,
    phase_description: 'Ready to crawl and synthesize',
    progress_percentage: 0,
    discovered_pdfs: [],
    synthesized_analysis: null,
    master_pdf_filename: null,
    master_pdf_size: 0,
    master_page_count: 0,
    error_message: null,
    logs: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isReMerging, setIsReMerging] = useState(false);

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [organizerTab, setOrganizerTab] = useState('layout');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePdfPreview, setActivePdfPreview] = useState(null);
  const [isHarvesterModalOpen, setIsHarvesterModalOpen] = useState(false);

  // SPA & Crawler Engine Settings
  const [crawlerMode, setCrawlerMode] = useState('auto');
  const [authCookies, setAuthCookies] = useState('');

  // API Keys
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_key') || '');

  const eventSourceRef = useRef(null);

  // Check URL query parameters (e.g., opened from Active Session Harvester bookmarklet)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlJobId = params.get('jobId');
    if (urlJobId) {
      setJobId(urlJobId);
      setIsLoading(true);
      fetch(`/api/jobs/${urlJobId}`)
        .then((res) => res.json())
        .then((data) => {
          setJobData(data);
          if (data.status !== 'completed' && data.status !== 'failed') {
            setupSSE(urlJobId);
          } else {
            setIsLoading(false);
          }
        })
        .catch(() => setIsLoading(false));
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const setupSSE = (newJobId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/stream/${newJobId}`);
    eventSourceRef.current = sse;

    sse.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobData((prev) => ({ ...prev, ...data }));
      } catch (err) {}
    });

    sse.addEventListener('progress', (e) => {
      try {
        const { phase, description, percentage, status } = JSON.parse(e.data);
        setJobData((prev) => ({
          ...prev,
          current_phase: phase,
          phase_description: description,
          progress_percentage: percentage,
          status: status || prev.status
        }));
      } catch (err) {}
    });

    sse.addEventListener('log', (e) => {
      try {
        const logEntry = JSON.parse(e.data);
        setJobData((prev) => ({
          ...prev,
          logs: [...prev.logs, logEntry]
        }));
      } catch (err) {}
    });

    sse.addEventListener('pdfs_updated', (e) => {
      try {
        const pdfs = JSON.parse(e.data);
        setJobData((prev) => ({ ...prev, discovered_pdfs: pdfs }));
      } catch (err) {}
    });

    sse.addEventListener('synthesis_ready', (e) => {
      try {
        const analysis = JSON.parse(e.data);
        setJobData((prev) => ({ ...prev, synthesized_analysis: analysis }));
      } catch (err) {}
    });

    sse.addEventListener('completed', (e) => {
      try {
        const info = JSON.parse(e.data);
        setJobData((prev) => ({
          ...prev,
          status: 'completed',
          current_phase: 4,
          progress_percentage: 100,
          phase_description: 'Master PDF compiled successfully',
          master_pdf_filename: info.filename,
          master_pdf_size: info.file_size,
          master_page_count: info.page_count
        }));
        setIsLoading(false);
        setIsReMerging(false);
        sse.close();
      } catch (err) {}
    });

    sse.addEventListener('error', (e) => {
      try {
        const errData = JSON.parse(e.data);
        setJobData((prev) => ({
          ...prev,
          status: 'failed',
          error_message: errData.message
        }));
      } catch (err) {}
      setIsLoading(false);
      setIsReMerging(false);
      sse.close();
    });

    sse.onerror = () => {
      // In case of network interruption, fallback to polling
      fetch(`/api/jobs/${newJobId}`)
        .then((res) => res.json())
        .then((data) => {
          setJobData(data);
          if (data.status === 'completed' || data.status === 'failed') {
            setIsLoading(false);
            setIsReMerging(false);
            sse.close();
          }
        })
        .catch(() => {});
    };
  };

  const handleStartPipeline = async (overrideUrl = null, isDemo = false) => {
    const url = overrideUrl || targetUrl;
    if (!url.trim()) return;

    setIsLoading(true);
    setJobData({
      status: 'queued',
      current_phase: 1,
      phase_description: 'Initializing crawler engine...',
      progress_percentage: 5,
      discovered_pdfs: [],
      synthesized_analysis: null,
      master_pdf_filename: null,
      master_pdf_size: 0,
      master_page_count: 0,
      error_message: null,
      logs: []
    });

    try {
      const resp = await fetch('/api/start-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: url,
          depth_level: depthLevel,
          openai_api_key: openaiKey || undefined,
          gemini_api_key: geminiKey || undefined,
          is_demo: isDemo || url.includes('demo'),
          include_cover_summary: includeCover,
          crawler_mode: crawlerMode,
          auth_cookies: authCookies || undefined
        })
      });

      if (!resp.ok) {
        throw new Error(`Failed to start job (HTTP ${resp.status})`);
      }

      const { job_id } = await resp.json();
      setJobId(job_id);
      setupSSE(job_id);
    } catch (err) {
      setJobData((prev) => ({
        ...prev,
        status: 'failed',
        error_message: err.message
      }));
      setIsLoading(false);
    }
  };

  const handleTogglePDF = async (pdfId, selected) => {
    if (!jobId) return;

    // Optimistically update
    setJobData((prev) => ({
      ...prev,
      discovered_pdfs: prev.discovered_pdfs.map((p) =>
        p.id === pdfId ? { ...p, selected } : p
      )
    }));

    try {
      await fetch(`/api/jobs/${jobId}/toggle-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: pdfId, selected })
      });
    } catch (e) {}
  };

  const handleBulkToggle = (selected) => {
    if (!jobId || !jobData.discovered_pdfs) return;
    const updated = jobData.discovered_pdfs.map((p) => ({ ...p, selected }));
    setJobData((prev) => ({ ...prev, discovered_pdfs: updated }));

    // Sync with backend
    updated.forEach((p) => {
      fetch(`/api/jobs/${jobId}/toggle-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: p.id, selected })
      }).catch(() => {});
    });
  };

  const handleReorderPDFs = async (newOrderIds) => {
    if (!jobId || !jobData.discovered_pdfs) return;

    // Local reorder
    const pdfMap = new Map(jobData.discovered_pdfs.map((p) => [p.id, p]));
    const reordered = newOrderIds.map((id) => pdfMap.get(id)).filter(Boolean);
    setJobData((prev) => ({ ...prev, discovered_pdfs: reordered }));

    try {
      await fetch(`/api/jobs/${jobId}/reorder-pdfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrderIds })
      });
    } catch (e) {}
  };

  const [includeCover, setIncludeCover] = useState(false);

  const handleReMerge = async () => {
    if (!jobId) return;
    setIsReMerging(true);
    try {
      await fetch(`/api/jobs/${jobId}/re-merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_cover_summary: includeCover })
      });
      setupSSE(jobId);
    } catch (err) {
      setIsReMerging(false);
    }
  };

  const isPipelineComplete = jobData.status === 'completed';
  const showProgress = jobData.status !== 'idle';

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900 flex flex-col font-sans selection:bg-green-500/20 selection:text-green-800">
      
      {/* Navbar */}
      <Navbar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-16">
        
        {/* Hero Section */}
        <HeroSection
          targetUrl={targetUrl}
          setTargetUrl={setTargetUrl}
          depthLevel={depthLevel}
          setDepthLevel={setDepthLevel}
          crawlerMode={crawlerMode}
          setCrawlerMode={setCrawlerMode}
          authCookies={authCookies}
          setAuthCookies={setAuthCookies}
          onStartPipeline={() => handleStartPipeline()}
          onOpenHarvesterModal={() => setIsHarvesterModalOpen(true)}
          isLoading={isLoading}
          currentStatus={jobData.status}
        />

        {/* Dynamic Progress Section */}
        {showProgress && (
          <ProgressBar
            currentPhase={jobData.current_phase}
            progressPercentage={jobData.progress_percentage}
            phaseDescription={jobData.phase_description}
            status={jobData.status}
            logs={jobData.logs}
            errorMessage={jobData.error_message}
          />
        )}

        {/* PDF Discovered Grid */}
        <PDFPreviewGrid
          jobId={jobId}
          discoveredPDFs={jobData.discovered_pdfs}
          onTogglePDF={handleTogglePDF}
          onSelectAll={() => handleBulkToggle(true)}
          onDeselectAll={() => handleBulkToggle(false)}
          onPreviewPDF={(pdf) => setActivePdfPreview(pdf)}
          onReorderPDFs={handleReorderPDFs}
          onReMerge={handleReMerge}
          isReMerging={isReMerging}
          isPipelineComplete={isPipelineComplete}
          includeCover={includeCover}
          setIncludeCover={setIncludeCover}
        />

        {/* Master PDF Download Hub */}
        <MasterDownloadHub
          jobId={jobId}
          masterFilename={jobData.master_pdf_filename}
          masterFileSize={jobData.master_pdf_size}
          masterPageCount={jobData.master_page_count}
          isReady={isPipelineComplete}
          onOpenOrganizer={(tab = 'layout') => {
            setOrganizerTab(tab);
            setIsOrganizerOpen(true);
          }}
        />

      </main>

      {/* Merged PDF Page Studio Modal */}
      <PDFPageOrganizerModal
        isOpen={isOrganizerOpen}
        onClose={() => setIsOrganizerOpen(false)}
        jobId={jobId}
        initialTab={organizerTab}
        onSaveEdits={(result) => {
          if (result && result.total_pages) {
            setJobData((prev) => ({
              ...prev,
              master_page_count: result.total_pages,
              master_pdf_size: result.file_size
            }));
          }
        }}
      />

      {/* RAG Chat Sidebar */}
      <RAGChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        jobId={jobId}
        isJobReady={isPipelineComplete}
        openaiKey={openaiKey}
        geminiKey={geminiKey}
      />

      {/* PDF Text Inspector Modal */}
      <PDFModal
        pdf={activePdfPreview}
        onClose={() => setActivePdfPreview(null)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        openaiKey={openaiKey}
        setOpenaiKey={setOpenaiKey}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
      />

      {/* Commercial & Authenticated SPA Harvester Modal */}
      <CommercialHarvesterModal
        isOpen={isHarvesterModalOpen}
        onClose={() => setIsHarvesterModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-[#edf1f5] py-6 text-center text-xs text-slate-500">
        <p>AI PDF Crawler &amp; Synthesizer • Autonomous Multi-Document Intelligence</p>
      </footer>

    </div>
  );
}
