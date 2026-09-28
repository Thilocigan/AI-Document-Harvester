import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

SAMPLES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "sample_pdfs"))

def ensure_sample_pdfs():
    os.makedirs(SAMPLES_DIR, exist_ok=True)

    samples = [
        {
            "filename": "Q4_Enterprise_AI_Strategy_2026.pdf",
            "title": "Enterprise AI Strategy & Infrastructure Blueprint 2026",
            "content": [
                ("1. Executive Strategic Direction", "Enterprise adoption of agentic AI systems has accelerated by 185% year-over-year. Key initiatives focus on autonomous multi-document parsing, enterprise data consolidation, and real-time knowledge graphs. Investment in GPU clusters and low-latency inference pipelines has expanded to support multi-modal agent workflows."),
                ("2. Architectural Scalability", "Deploying scalable vector databases such as ChromaDB, Pinecone, and pgvector provides high-throughput cosine similarity indexing. Microservice architectures utilizing FastAPI for asynchronous streaming and Next.js for client interfaces reduce latency down to sub-100ms for active queries."),
                ("3. Risk Mitigation & Compliance", "Stringent data governance mandates end-to-end encryption for in-transit PDF ingestion and secure ephemeral storage buckets. Automated redaction and compliance audit logs ensure enterprise adherence to GDPR, SOC2, and ISO 27001 standards.")
            ]
        },
        {
            "filename": "Global_Climate_Impact_Report_2026.pdf",
            "title": "Global Climate & Sustainable Technology Assessment",
            "content": [
                ("1. Global Carbon Metrics & Observations", "Atmospheric monitoring across 42 global stations confirms a 12% rise in clean energy deployment offsetting industrial emissions. Smart grids and renewable integration models demonstrate actionable decarbonization across heavy manufacturing."),
                ("2. Sustainable Computing & Data Center Efficiency", "Data center power usage effectiveness (PUE) dropped to an average of 1.14 across top-tier green computing clusters. Liquid cooling architectures and dynamic power throttling for LLM training workloads contributed to a 28% reduction in energy overhead."),
                ("3. Strategic Policy Recommendations", "Governments and multilateral agencies recommend accelerated tax credits for carbon capture utilization, along with stringent public disclosure requirements for data center power consumption and water utilization efficiency.")
            ]
        },
        {
            "filename": "Healthcare_Autonomous_Systems_Whitepaper.pdf",
            "title": "Autonomous Clinical AI & Biomedical Document Synthesis",
            "content": [
                ("1. Clinical Workflow Modernization", "Automated clinical document ingestion streamlines diagnostic summaries and electronic health record (EHR) consolidation. Physicians report a 40% reduction in administrative overhead when using multi-document synthesis platforms."),
                ("2. Diagnostic Accuracy & Model Safety", "Rigorous double-blind evaluation of multi-modal biomedical LLMs shows 98.4% precision in extracting pharmacological interactions from dense clinical trials. Human-in-the-loop review remains critical for high-stakes surgical guidance."),
                ("3. Regulatory & Privacy Standards", "HIPAA-compliant document synthesis pipelines require automated de-identification of Protected Health Information (PHI) before vector embedding and LLM summarization.")
            ]
        }
    ]

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle('SampleH1', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=colors.HexColor("#0f172a"), spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle('SampleBody', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor("#334155"), spaceAfter=8)
    title_st = ParagraphStyle('SampleTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor("#0284c7"), spaceAfter=12)

    generated_paths = []
    for s in samples:
        filepath = os.path.join(SAMPLES_DIR, s["filename"])
        if not os.path.exists(filepath):
            doc = SimpleDocTemplate(filepath, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
            story = [
                Paragraph(s["title"], title_st),
                Spacer(1, 10)
            ]
            for sec_title, sec_body in s["content"]:
                story.append(Paragraph(sec_title, h1))
                story.append(Paragraph(sec_body, body))
                story.append(Spacer(1, 6))

            # Add sample table
            data = [
                ["Metric / KPI", "Current Value", "Target 2027", "Status"],
                ["Throughput Rate", "1,420 docs/sec", "2,500 docs/sec", "Optimal"],
                ["Synthesis Accuracy", "99.2%", "99.8%", "Exceeding"],
                ["Latency (p99)", "82 ms", "60 ms", "On Track"]
            ]
            t = Table(data, colWidths=[140, 110, 110, 110])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(Spacer(1, 10))
            story.append(t)
            doc.build(story)
        generated_paths.append(filepath)

    return generated_paths

if __name__ == "__main__":
    paths = ensure_sample_pdfs()
    print(f"Generated {len(paths)} sample PDFs")
