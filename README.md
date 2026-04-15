# 🏆 Certificate Maker

A modern, responsive web application to create and download professional-quality certificates as PDF files — instantly, in the browser.

## ✨ Features

- **Real-time Preview** — See your certificate update live as you type
- **PDF Export** — Download a high-resolution A4 landscape PDF (300 DPI via `html-to-image` + `jsPDF`)
- **Fully Responsive** — Optimized for mobile, tablet, and desktop screens
- **No backend required** — Everything runs client-side
- **Unique Certificate IDs** — Each certificate gets a random ID stamped at the bottom
- **Dark mode UI** — Sleek dark theme with glassmorphism design

## 🛠 Tech Stack

| Tool | Purpose |
|------|---------|
| [React 18](https://react.dev/) | UI framework |
| [Vite 5](https://vitejs.dev/) | Build tool & dev server |
| [Tailwind CSS 3](https://tailwindcss.com/) | Utility-first styling |
| [html-to-image](https://github.com/bubkoo/html-to-image) | Certificate canvas capture |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF generation |

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/certficate-maker.git
cd certficate-maker

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 Usage

1. Fill in the **Recipient Name**, **Mobile**, and **Email** (required)
2. Optionally add a **Course / Program** name and **Organization**
3. Click **Generate Certificate** to see the live preview
4. Click **Download PDF** to save the certificate as a high-quality PDF

## 📁 Project Structure

```
src/
├── components/
│   ├── CertificatePreview.jsx  # Scaled live preview + PDF export logic
│   ├── CertificateTemplate.jsx # The actual certificate layout (A4)
│   ├── CornerOrnament.jsx      # SVG decorative corner elements
│   ├── SealIcon.jsx            # Central seal emblem SVG
│   └── UserForm.jsx            # Input form with validation
├── App.jsx                     # Root layout: nav + two-panel grid
├── index.css                   # Tailwind base + custom utilities
└── main.jsx                    # React entry point
```

## 📄 License

MIT
