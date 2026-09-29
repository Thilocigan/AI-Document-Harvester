# 💻 Complete Setup Guide for a New Computer
### AI-Driven PDF Crawler & Synthesizer

This guide provides step-by-step instructions for moving, installing, and running this application on any brand new computer (Windows, macOS, or Linux).

---

## 📦 Step 1: Download from GitHub to the New Computer

Choose whichever method is easier for you on the new computer:

### Option A: Direct Download as ZIP (Easiest — No Git required)
1. On the new computer, open your browser and go to your GitHub repository:
   `https://github.com/YOUR-USERNAME/AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER`
2. Click the green **`<> Code`** button at the top right of the file list.
3. Click **"Download ZIP"**.
4. Once downloaded, right-click the `.zip` file, select **"Extract All..."**, and extract it to your preferred location (e.g. `C:\Projects\` or `D:\Projects\`).

---

### Option B: Clone using Git (If Git is installed)
Open a terminal (PowerShell, Command Prompt, or Terminal) and run:
```bash
git clone https://github.com/YOUR-USERNAME/AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER.git
cd AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER
```
*(Note: Because `.gitignore` cleanly excluded `venv` and `node_modules`, the download from GitHub is tiny and fast! We will install them freshly in Step 3).*

---

## ⚙️ Step 2: Install Prerequisites on the New Computer

Before running the project, make sure the new computer has the following two free tools installed:

### 1. Python 3.10 or higher
- **Download**: [python.org/downloads](https://www.python.org/downloads/)
- ⚠️ **VERY IMPORTANT (Windows)**: During installation, make sure to check the box that says **"Add python.exe to PATH"** at the bottom of the installer window!
- **Verify installation** in a terminal:
  ```powershell
  python --version
  ```
  *(Should output `Python 3.10.x` or higher)*

### 2. Node.js (LTS version)
- **Download**: [nodejs.org](https://nodejs.org/) (Choose the **LTS** version)
- Run the installer with default settings.
- **Verify installation** in a terminal:
  ```powershell
  node --version
  npm --version
  ```
  *(Should output `v18.x`, `v20.x`, or `v22.x`)*

---

## 🚀 Step 3: Run the Setup

Choose the setup method you prefer:

### 🌟 Method A: 1-Click Automated Setup (Easiest - Windows)

1. Open the project folder `AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER`.
2. **Double-click** `setup_new_computer.bat`.
3. The script will automatically:
   - Verify Python and Node.js are installed.
   - Create a clean Python virtual environment (`backend\venv`).
   - Install all required Python packages (`FastAPI`, `PyMuPDF`, `Brotli`, `ReportLab`, `Scikit-Learn`, etc.).
   - Install all frontend React packages (`npm install`).
   - Ask if you would like to launch the app immediately.

*(Alternatively, simply double-clicking `start.bat` on a new PC will also auto-detect missing packages and set them up automatically!)*

---

### 🛠️ Method B: Step-by-Step Manual Setup (Windows)

If you prefer using the terminal (PowerShell or Command Prompt):

#### 1. Setup the Backend:
```powershell
# Open terminal inside the project directory
cd d:\AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER\backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1
# (Or in CMD: .\venv\Scripts\activate.bat)

# Upgrade pip and install all dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### 2. Setup the Frontend:
```powershell
# Move into frontend folder
cd ..\frontend

# Install all Node dependencies
npm install
```

---

### 🐧 Method C: Step-by-Step Manual Setup (macOS / Linux)

#### 1. Setup the Backend:
```bash
cd AI_DRIVEN_PDF_CRAWLER_SYNTHESIZER/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2. Setup the Frontend:
```bash
cd ../frontend
npm install
```

---

## ▶️ Step 4: How to Run the Application Everyday

Once setup is complete, you can launch the platform with **one command**:

### On Windows:
- Double-click **`start.bat`**  
  *OR*
- In PowerShell, run:
  ```powershell
  .\start.ps1
  ```
*(This automatically boots the FastAPI backend on port 8000, the Vite React UI on port 5173, and opens your default browser!)*

### Manual Launch (Any OS):
If you want to start the backend and frontend separately:

1. **Terminal 1 (Backend API)**:
   ```bash
   cd backend
   # Windows:
   venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   # Mac/Linux:
   source venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Terminal 2 (Frontend UI)**:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and go to:
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🔑 Step 5: AI Keys Configuration (Optional)

The application has a **built-in Zero-Dependency Intelligent NLP Engine** enabled by default, meaning:
- **No API keys or credit cards are needed** to crawl, extract text, deduplicate, merge PDFs, or use the Page Studio!
---

## 📄 Step 6: Combining Your Own Local PDF Files from PC

You can combine existing PDF files from your computer storage with web-crawled documents without any extra configuration:
1. Click **"🛠️ Reorder & Organize Pages"** or **"➕ Add Local PDF from PC"** on the Master Download Hub.
2. In the Page Studio, click the green **"➕ Add PDF from PC"** button or drag-and-drop `.pdf` files directly onto the dropzone.
3. The uploaded files are immediately parsed and appended, allowing you to drag-and-drop rearrange their pages, delete unwanted pages, rotate them, or apply watermarks and page numbering.
4. Click **"Save & Update Merged PDF"** to produce your final unified document.

---

## ❓ Troubleshooting & FAQs

### 1. `python` or `pip` is not recognized as an internal or external command
- **Cause**: Python was installed without checking "Add Python to PATH".
- **Fix**: Re-run the Python installer, select **Modify**, and make sure **"Add Python to environment variables"** is checked.

### 2. PowerShell says: `running scripts is disabled on this system`
- **Cause**: Windows PowerShell default security restriction on `.ps1` scripts.
- **Fix**: Either run `start.bat` instead (batch files don't have this restriction), or run this one-time command in PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

### 3. Port 8000 or Port 5173 is already in use
- **Cause**: Another application or previous background process is using the port.
- **Fix (Windows)**:
  ```powershell
  # Find and close any lingering python/uvicorn process:
  Stop-Process -Name python, uvicorn -Force -ErrorAction SilentlyContinue
  ```

### 4. Live website download gives compressed data or errors
- The `brotli` decompression package is already included in `requirements.txt`. Ensure your virtual environment ran `pip install -r requirements.txt`.
