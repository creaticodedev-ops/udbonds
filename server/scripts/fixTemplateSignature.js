import mongoose from 'mongoose';
import ExportTemplate from '../models/ExportTemplate.js';

async function fixTemplateSignaturePlaceholder() {
  console.log('\n=== TEMPLATE FIX: ADD CUSTOMER SIGNATURE PLACEHOLDER ===\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/car-rental');
    
    // Find all templates that might be missing the signature placeholder
    const templates = await ExportTemplate.find({ type: 'contract' });
    
    console.log(`[1] Found ${templates.length} contract templates`);
    
    let fixed = 0;
    
    for (const template of templates) {
      const bodyHtml = template.bodyHtml || '';
      
      // Check if it has customer signature box but missing the placeholder
      if (bodyHtml.includes('Signature du locataire') && !bodyHtml.includes('{{customer_signature_html}}')) {
        console.log(`\n[FIXING] Template: ${template.name} (${template._id})`);
        
        // Pattern 1: <span class="muted">{{customer_name}}</span></div>
        const pattern1 = /<span class="muted">\{\{customer_name\}\}<\/span><\/div>/;
        const replacement1 = '<span class="muted">{{customer_name}}</span><br/>{{customer_signature_html}}</div>';
        
        const newBodyHtml = bodyHtml.replace(pattern1, replacement1);
        
        if (newBodyHtml !== bodyHtml) {
          template.bodyHtml = newBodyHtml;
          await template.save();
          console.log(`[✓] Template fixed and saved`);
          fixed++;
        } else {
          console.log(`[!] Pattern not found, skipping`);
        }
      } else if (bodyHtml.includes('{{customer_signature_html}}')) {
        console.log(`[✓] Template "${template.name}" already has signature placeholder`);
      } else {
        console.log(`[!] Template "${template.name}" does NOT have signature section at all`);
      }
    }
    
    console.log(`\n[RESULT] Fixed ${fixed} templates`);
    
  } catch (err) {
    console.error('[ERROR]', err.message);
  }

  process.exit(0);
}

await fixTemplateSignaturePlaceholder();
