export const NN_STYLES = `<style>
/* --- LAYOUT RESET & SAFETY NETS --- */
.nn-wrap{max-width:1200px;margin:0 auto;padding:1rem;font-family:'Open Sans',system-ui,-apple-system,sans-serif}
.nn-topnav p, .nn-grid p, .nn-product-image-container p { display: contents; margin: 0; padding: 0; }
p:empty { display: none; }

/* --- SECTIONS & TYPOGRAPHY --- */
.nn-h1{font-family:'Oswald',sans-serif;color:#1a1a1a;margin-bottom:1rem;font-size:2.8rem;line-height:1.2;font-weight:700}
.nn-h2{font-family:'Oswald',sans-serif;color:#1a1a1a;font-size:2.2rem;line-height:1.3;font-weight:600;margin-top:2.5rem;margin-bottom:1rem}
.nn-h3{font-family:'Oswald',sans-serif;color:#2d2d2d;font-size:1.6rem;font-weight:600;margin-top:1.5rem;margin-bottom:0.75rem}
.nn-body{font-family:'Open Sans',sans-serif;font-size:1.1rem;line-height:1.7;color:#2d2d2d}
.nn-sm{font-size:1.5rem!important;color:#666;line-height:1.6}
.nn-center{text-align:center}

/* --- NAVIGATION (ROUNDED PILLS) --- */
.nn-topnav{display:flex;gap:0.75rem;flex-wrap:wrap;padding:0;margin-bottom:2.5rem;background:transparent}
.nn-topnav a{background:#00A3FF!important;color:#fff!important;text-decoration:none;font-family:'Oswald',sans-serif;font-size:1rem!important;font-weight:600;padding:0.6rem 1.25rem;border-radius:50px;transition:background 0.2s;line-height:1;display:inline-block;text-transform:uppercase;letter-spacing:0.03em}
.nn-topnav a:hover{background:#0088dd!important}

/* --- KICKER & META --- */
.nn-kicker{font-family:'Oswald',sans-serif;font-size:0.85rem;font-weight:600;text-transform:uppercase;color:#00A3FF;margin-bottom:0.5rem;letter-spacing:0.05em}
.nn-meta{display:flex;gap:0.5rem;align-items:center;font-size:0.9rem;color:#666;margin-top:0.75rem}

/* --- CONTAINERS --- */
.nn-section{margin:3rem 0;clear:both}
.nn-muted{background:#f0f8ff;padding:2rem;border-radius:12px;border:1px solid #d0e8f5}
.nn-callout{border-left:5px solid #00A3FF;padding:1.25rem 1.5rem;background:#f0f8ff;border-radius:0 8px 8px 0;margin:2rem 0}
.nn-key-takeaway{border-left:5px solid #00C853;padding:1.25rem 1.5rem;background:#e8f5e9;border-radius:0 8px 8px 0;margin:2rem 0}

/* --- GRIDS & CARDS --- */
.nn-grid{display:grid;gap:1.5rem;margin:2rem 0}
.nn-grid.cols-2{grid-template-columns:repeat(2,1fr)}
.nn-grid.cols-3{grid-template-columns:repeat(3,1fr)}
.nn-card{border:1px solid #e0e0e0;border-radius:12px;padding:1.5rem;height:100%;background:#fff;display:flex;flex-direction:column}

/* --- PRODUCT CARDS --- */
.nn-product-card{background:#fff;border:2px solid #e5e7eb;border-radius:16px;padding:1.5rem;display:flex;flex-direction:column;height:100%;position:relative;overflow:hidden;transition:all 0.3s ease}
.nn-product-card:hover{box-shadow:0 12px 24px -6px rgba(0,163,255,0.15);transform:translateY(-3px);border-color:#00A3FF}
.nn-product-card h3{font-family:'Oswald',sans-serif;font-size:1.4rem;margin:0.5rem 0;color:#1a1a1a}
.nn-product-card ul{margin:0.75rem 0;padding-left:0;list-style:none;font-size:0.95rem}
.nn-product-card li{margin-bottom:0.5rem;line-height:1.5}
.nn-product-image-container{text-align:center;margin-bottom:1rem;width:100%;height:220px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:12px;overflow:hidden}
.nn-product-image{max-width:100%;max-height:200px;object-fit:contain;transition:transform 0.3s}
.nn-product-card:hover .nn-product-image{transform:scale(1.05)}

/* --- BUTTONS & LINKS --- */
.nn-links{color:#00A3FF!important;text-decoration:none;font-weight:600}
.nn-links:hover{text-decoration:underline}
.nn-cta{display:inline-block;padding:0.75rem 1.75rem;background:#00A3FF!important;color:#fff!important;text-decoration:none;border-radius:8px;font-family:'Oswald',sans-serif;font-weight:600;text-align:center;transition:background 0.2s;text-transform:uppercase;letter-spacing:0.03em}
.nn-cta:hover{background:#0088dd!important;color:#fff!important}
.nn-cta-secondary{display:inline-block;padding:0.75rem 1.75rem;background:transparent;color:#00A3FF!important;text-decoration:none;border:2px solid #00A3FF;border-radius:8px;font-family:'Oswald',sans-serif;font-weight:600;text-align:center;transition:all 0.2s;text-transform:uppercase}
.nn-cta-secondary:hover{background:#e6f4ff}

/* --- EMAIL CAPTURE GATE --- */
.nn-email-gate{background:linear-gradient(135deg,#f0f8ff 0%,#e6f4ff 100%);border:2px solid #00A3FF;border-radius:16px;padding:2.5rem;text-align:center;margin:3rem 0}
.nn-email-gate h3{font-family:'Oswald',sans-serif;font-size:1.8rem;color:#1a1a1a;margin-bottom:0.75rem}
.nn-email-gate p{font-size:1.05rem;color:#4a5568;margin-bottom:1.5rem}
.nn-email-gate .nn-incentive{display:inline-block;background:#00C853;color:#fff;padding:0.35rem 1rem;border-radius:50px;font-size:0.85rem;font-weight:700;margin-bottom:1rem}

/* --- CALCULATOR EMBED --- */
.nn-calculator-embed{border:1px solid #e0e0e0;border-radius:16px;padding:0;margin:2.5rem 0;overflow:hidden;background:#fff}
.nn-calculator-embed iframe{width:100%;border:none;min-height:500px}

/* --- COMPARISON TABLE --- */
.nn-comparison-table{width:100%;border-collapse:collapse;margin:2rem 0;font-size:0.95rem}
.nn-comparison-table th{background:#1a1a1a;color:#fff;font-family:'Oswald',sans-serif;font-weight:600;padding:0.75rem 1rem;text-align:left;position:sticky;top:0}
.nn-comparison-table td{padding:0.75rem 1rem;border-bottom:1px solid #e0e0e0}
.nn-comparison-table tr:nth-child(even){background:#f8f9fa}
.nn-check{color:#00C853;font-weight:700}
.nn-cross{color:#dc2626;font-weight:700}

/* --- IMAGES --- */
.nn-content-image{width:100%;max-width:800px;display:block;margin:2.5rem auto!important;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);float:none!important}
.nn-content-image img{width:100%;max-width:800px;height:auto;object-fit:contain;display:block;float:none!important;margin:0 auto!important;border-radius:12px}
.nn-badge{display:inline-block;padding:0.3rem 0.85rem;border-radius:9999px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#fff}

/* --- FAQ --- */
.nn-faq-list{border-top:1px solid #e0e0e0;margin-top:2rem}
.nn-faq-item{border-bottom:1px solid #e0e0e0}
.nn-faq-question{width:100%;text-align:left;padding:1.25rem 0;font-family:'Oswald',sans-serif;font-size:1.2rem;font-weight:600;cursor:pointer;list-style:none;color:#1a1a1a}
.nn-faq-question::-webkit-details-marker{display:none}
.nn-faq-question::before{content:"+";float:right;font-size:1.5rem;font-weight:300;color:#00A3FF}
details[open] .nn-faq-question::before{content:"−"}
.nn-faq-answer{padding:0 0 1.25rem 0;color:#4a5568;line-height:1.7}

/* --- MOBILE --- */
@media(max-width:768px){
.nn-grid.cols-2,.nn-grid.cols-3{grid-template-columns:1fr}
.nn-product-image-container{height:200px}
.nn-cta,.nn-cta-secondary{width:100%;text-align:center}
.nn-email-gate{padding:1.5rem}
.nn-topnav{justify-content:center}
}
</style>`;
