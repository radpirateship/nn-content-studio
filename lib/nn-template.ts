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

/* --- SUBTITLE --- */
.nn-subtitle{font-size:1.2rem;color:#4a5568;line-height:1.5;margin-bottom:0.5rem;font-style:italic}
.nn-dot{width:4px;height:4px;border-radius:50%;background:#8a94a0;display:inline-block}

/* --- QUICK ANSWER BOX --- */
.nn-quick-answer{border:2px solid #1a1a1a;border-radius:12px;padding:1.75rem 2rem;margin:2rem 0;background:#fff}
.nn-quick-answer-header{display:flex;align-items:center;gap:0.5rem;font-family:'Oswald',sans-serif;font-size:1.1rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#1a1a1a;margin-bottom:1rem}
.nn-quick-answer-header span{width:28px;height:28px;background:#1a1a1a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:0.8rem}
.nn-quick-answer-text{font-family:'Open Sans',sans-serif;font-size:1.15rem;line-height:1.6;color:#1a1a1a}
.nn-quick-answer-text strong{color:#00C853}

/* --- HERO IMAGE --- */
.nn-hero-image{width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin:1.5rem 0 0.5rem;box-shadow:0 8px 24px rgba(0,0,0,0.1)}
.nn-hero-placeholder{width:100%;height:320px;background:linear-gradient(135deg,#f0f4f8 0%,#e2e8f0 50%,#f0f4f8 100%);border-radius:16px;margin:1.5rem 0 0.5rem;display:flex;align-items:center;justify-content:center;color:#8a94a0;font-family:'Oswald',sans-serif;font-size:1rem;text-transform:uppercase;letter-spacing:0.05em}

/* --- INFO BOXES WITH ICONS --- */
.nn-info-box{background:#f8f9fa;border-radius:12px;padding:2rem;margin:2rem 0;border:1px solid #e0e0e0}
.nn-info-box-header{display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem}
.nn-info-box-icon{width:48px;height:48px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nn-info-box-icon span{color:#fff;font-size:1.3rem}
.nn-info-box-title{font-family:'Oswald',sans-serif;font-size:1.3rem;font-weight:600;color:#1a1a1a}
.nn-info-box ul{margin:0;padding-left:0;list-style:none}
.nn-info-box li{padding:0.4rem 0;font-size:1rem;line-height:1.5;color:#2d2d2d}
.nn-info-box li::before{content:"✓ ";color:#00C853;font-weight:700}

/* --- IMMERSIVE PRODUCT CTA --- */
.nn-product-hero{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);border-radius:20px;padding:3rem;margin:3rem 0;display:flex;gap:2.5rem;align-items:center;color:#fff;overflow:hidden;position:relative}
.nn-product-hero::before{content:"";position:absolute;top:-50%;right:-10%;width:300px;height:300px;background:radial-gradient(circle,rgba(0,163,255,0.15) 0%,transparent 70%);border-radius:50%}
.nn-product-hero-image{flex-shrink:0;width:280px;height:280px;background:rgba(255,255,255,0.05);border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;z-index:1}
.nn-product-hero-image img{max-width:260px;max-height:260px;object-fit:contain}
.nn-product-hero-content{flex:1;position:relative;z-index:1}
.nn-product-hero-badge{display:inline-block;background:#00A3FF;color:#fff;padding:0.3rem 0.85rem;border-radius:50px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem}
.nn-product-hero h3{font-family:'Oswald',sans-serif;font-size:2rem;color:#fff;margin:0 0 0.5rem;line-height:1.2}
.nn-product-hero-features{list-style:none;padding:0;margin:1rem 0}
.nn-product-hero-features li{padding:0.3rem 0;font-size:1rem;color:rgba(255,255,255,0.9)}
.nn-product-hero-features li::before{content:"✓ ";color:#00C853;font-weight:700}
.nn-product-hero-price{font-family:'Oswald',sans-serif;font-size:2.2rem;font-weight:700;color:#00C853;margin:1rem 0}
.nn-product-hero-stars{color:#FFD700;font-size:1rem;margin-bottom:1rem;letter-spacing:2px}
.nn-product-hero .nn-cta{font-size:1.1rem;padding:1rem 2.5rem}

/* --- CUSTOMER TESTIMONIALS --- */
.nn-testimonials{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);border-radius:20px;padding:3rem;margin:3rem 0;color:#fff}
.nn-testimonials h2{color:#fff;text-align:center;margin-bottom:2rem}
.nn-testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.nn-testimonial-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:1.5rem}
.nn-testimonial-stars{color:#FFD700;font-size:0.9rem;margin-bottom:0.75rem;letter-spacing:2px}
.nn-testimonial-quote{font-style:italic;font-size:0.95rem;line-height:1.6;color:rgba(255,255,255,0.85);margin-bottom:1rem}
.nn-testimonial-author{font-family:'Oswald',sans-serif;font-size:0.85rem;font-weight:600;color:#00A3FF}
.nn-testimonial-verified{font-size:0.75rem;color:rgba(255,255,255,0.5);margin-top:0.25rem}

/* --- VIDEO EMBED --- */
.nn-video-embed{position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;margin:2.5rem 0;box-shadow:0 8px 24px rgba(0,0,0,0.12)}
.nn-video-embed iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}

/* --- MOBILE --- */
@media(max-width:768px){
.nn-grid.cols-2,.nn-grid.cols-3{grid-template-columns:1fr}
.nn-product-image-container{height:200px}
.nn-cta,.nn-cta-secondary{width:100%;text-align:center}
.nn-email-gate{padding:1.5rem}
.nn-topnav{justify-content:center}
.nn-product-hero{flex-direction:column;padding:2rem;text-align:center}
.nn-product-hero-image{width:min(200px,60vw);height:auto;aspect-ratio:1;margin:0 auto}
.nn-testimonials-grid{grid-template-columns:1fr}
.nn-quick-answer{padding:1.25rem}
}
</style>`;
