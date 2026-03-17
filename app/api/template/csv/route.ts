import { NextResponse } from "next/server";

export async function GET() {
  const csvContent = [
    "title,keyword,category,tone,wordCount,shopifySlug,shopifyBlogTag,includeProducts,includeFAQ,includeSchema",
    '"Best Sensory Deprivation Tanks for Home Use in 2025",best sensory deprivation tanks,Sensory Deprivation Tanks,educational,2000,best-sensory-deprivation-tanks-home,float-therapy,true,true,true',
    '"Cold Plunge Benefits: What Science Really Says",cold plunge benefits,cold-plunge,educational,2500,cold-plunge-benefits-science,cold-therapy,true,true,true',
    '"Infrared Sauna vs Traditional: Which Is Better?",infrared vs traditional sauna,saunas,comparison,2000,infrared-vs-traditional-sauna,sauna-therapy,true,true,true',
    '"Red Light Therapy for Skin: Complete Guide",red light therapy skin,red-light-therapy,educational,2000,red-light-therapy-skin-guide,red-light-therapy,true,true,true',
    '"Hyperbaric Oxygen Therapy at Home: Is It Worth It?",hyperbaric therapy home,hyperbaric-chambers,educational,2000,hyperbaric-therapy-home-worth-it,hyperbaric-therapy,true,true,true',
    '"Best Massage Guns for Recovery in 2025",best massage guns,massage-equipment,listicle,2000,best-massage-guns-recovery,massage-therapy,true,true,true',
    '"Ice Bath vs Cold Shower: Recovery Comparison",ice bath vs cold shower,cold-plunge,comparison,1800,ice-bath-vs-cold-shower,cold-therapy,true,true,true',
  ].join("\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bulk-articles-template.csv"',
    },
  });
}
