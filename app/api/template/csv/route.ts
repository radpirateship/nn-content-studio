import { NextResponse } from "next/server";

export async function GET() {
  const csvContent = [
    "title,keyword,category,tone,wordCount,shopifySlug,shopifyBlogTag,includeProducts,includeFAQ,includeSchema",
    '"Best Whey Protein Powder: Complete Guide for 2025",best whey protein powder,whey-protein,educational,2500,best-whey-protein-powder-guide,protein,true,true,true',
    '"Creatine Monohydrate: Benefits, Dosing & Side Effects",creatine monohydrate benefits,supplements,educational,2000,creatine-monohydrate-complete-guide,supplements,true,true,true',
    '"Whey vs Plant Protein: Which Is Better?",whey vs plant protein,protein-powder,comparison,2000,whey-vs-plant-protein-comparison,protein,true,true,true',
    '"Collagen Peptides Benefits: What the Science Says",collagen peptides benefits,collagen-peptides,educational,2000,collagen-peptides-benefits-science,supplements,true,true,true',
    '"Pre-Workout Supplements: How to Choose the Right One",pre workout supplements guide,supplements,educational,1800,pre-workout-supplements-guide,supplements,true,true,true',
    '"Protein Powder for Weight Loss: Does It Actually Work?",protein powder weight loss,protein-powder,educational,2000,protein-powder-weight-loss-guide,protein,true,true,true',
    '"BCAA vs EAA: Which Amino Acid Supplement Wins?",bcaa vs eaa supplements,supplements,comparison,1800,bcaa-vs-eaa-comparison,supplements,true,true,true',
  ].join("\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bulk-articles-template.csv"',
    },
  });
}
