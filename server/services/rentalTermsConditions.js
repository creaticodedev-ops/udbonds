/**
 * General rental terms (verso) — French A4, print-friendly.
 * Placeholders: {{agency_name}}, {{agency_phone}}, {{agency_email}}, {{agency_address}}
 */
export const DEFAULT_CONTRACT_TERMS_HTML = `
<div class="terms-doc">
  <div class="terms-head">
    <p class="terms-kicker">{{agency_name}}</p>
    <h1 class="terms-main-title">Conditions Générales de Location</h1>
    <p class="terms-sub">Contrat n° {{contract_number}} · Réservation {{reservation_id}}</p>
  </div>

  <p class="terms-intro">Les présentes conditions générales s'appliquent à toute location de véhicule conclue avec {{agency_name}}. Le locataire déclare les avoir lues, comprises et acceptées sans réserve lors de la signature du contrat face (recto).</p>

  <section class="terms-section">
    <h2>1. Objet et durée</h2>
    <p>Le bailleur met à disposition du locataire le véhicule identifié au contrat, pour une durée déterminée aux dates et heures indiquées. Toute prolongation est soumise à accord écrit du bailleur et à disponibilité du véhicule.</p>
  </section>

  <section class="terms-section">
    <h2>2. Caution remboursable</h2>
    <p>Une caution remboursable est exigée avant la remise des clés. Le montant varie selon la catégorie du véhicule (à partir de 5&nbsp;000 MAD). Elle est restituée après restitution du véhicule, déduction faite des sommes dues (dommages, consommables, infractions, carburant manquant, retard, etc.).</p>
  </section>

  <section class="terms-section">
    <h2>3. Franchise et assurance</h2>
    <p>Le véhicule est couvert par une assurance responsabilité civile conforme à la réglementation marocaine. Une franchise reste à la charge du locataire en cas de sinistre responsable, vol ou incendie, selon le montant indiqué au contrat. Le locataire peut souscrire une option de réduction de franchise lorsque proposée.</p>
  </section>

  <section class="terms-section">
    <h2>4. Conducteur(s) autorisé(s)</h2>
    <p>Seul(s) le(s) conducteur(s) désigné(s) au contrat, titulaire(s) d'un permis valide depuis au moins un an, peut/peuvent conduire le véhicule. Tout conducteur additionnel doit être déclaré et accepté par le bailleur. Le locataire demeure solidaire de toute utilisation du véhicule.</p>
  </section>

  <section class="terms-section">
    <h2>5. Utilisation du véhicule</h2>
    <ul>
      <li>Usage strictement privé et routier, sur routes goudronnées, au Maroc sauf autorisation écrite contraire.</li>
      <li>Interdiction de sous-location, transport rémunéré de personnes ou marchandises, compétition, conduite hors route, ou usage illicite.</li>
      <li>Interdiction de fumer dans le véhicule sauf accord express.</li>
      <li>Respect du code de la route et des limitations de vitesse ; port obligatoire des documents et équipements de sécurité.</li>
    </ul>
  </section>

  <section class="terms-section">
    <h2>6. État du véhicule — prise en charge et restitution</h2>
    <p>Le locataire reconnaît avoir reçu le véhicule en bon état de marche et d'entretien (check-list jointe au contrat). Il s'engage à le restituer dans le même état, salissures normales exceptées, aux date, heure et lieu convenus. Tout retard peut entraîner la facturation de journées supplémentaires au tarif en vigueur.</p>
  </section>

  <section class="terms-section">
    <h2>7. Carburant, péages et accessoires</h2>
    <p>Le véhicule est remis avec le niveau de carburant indiqué au contrat et doit être restitué au même niveau, faute de quoi un forfait carburant sera appliqué. Péages, parking, amendes et contraventions sont à la charge exclusive du locataire.</p>
  </section>

  <section class="terms-section">
    <h2>8. Entretien et panne</h2>
    <p>En cas de défaut mécanique non imputable au locataire, celui-ci doit prévenir immédiatement le bailleur et suivre ses instructions. Aucune réparation ne peut être entreprise sans accord préalable, sauf urgence de sécurité.</p>
  </section>

  <section class="terms-section">
    <h2>9. Sinistre, vol et déclaration</h2>
    <p>En cas d'accident, vol ou dégradation, le locataire doit avertir le bailleur et les autorités compétentes sans délai, remplir un constat amiable lorsque applicable et ne pas reconnaître de responsabilité sans accord écrit du bailleur.</p>
  </section>

  <section class="terms-section">
    <h2>10. Paiement</h2>
    <p>Le prix de location, les frais de livraison/reprise, les options et la caution sont payables selon les modalités convenues. Le bailleur peut exiger un prépaiement ou une empreinte bancaire. Toute somme impayée produira intérêt et frais de recouvrement conformément à la loi.</p>
  </section>

  <section class="terms-section">
    <h2>11. Résiliation — non-restitution</h2>
    <p>En cas de non-restitution, d'utilisation abusive ou de violation grave des présentes conditions, le bailleur peut résilier le contrat, récupérer le véhicule aux frais du locataire et engager toute action utile.</p>
  </section>

  <section class="terms-section">
    <h2>12. Données personnelles</h2>
    <p>Les données collectées sont traitées pour la gestion de la location, la facturation, la prévention des fraudes et le respect des obligations légales. Le locataire dispose des droits prévus par la loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.</p>
  </section>

  <section class="terms-section">
    <h2>13. Litiges et droit applicable</h2>
    <p>Les parties s'efforcent de régler tout différend à l'amiable. À défaut, les tribunaux du ressort du siège de {{agency_name}} seront seuls compétents, sous réserve des dispositions d'ordre public. Le droit marocain s'applique.</p>
  </section>

  <p class="terms-contact muted">Pour toute question : {{agency_name}} — {{agency_address}} — Tél. {{agency_phone}} — {{agency_email}}</p>
</div>
`;

export const DEFAULT_CONTRACT_TERMS_CSS = `
  .doc-page-terms { padding: 8mm 10mm !important; }
  .terms-doc { font-size: 7.5pt; line-height: 1.35; color: #222; }
  .terms-head { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #E62117; }
  .terms-kicker { font-size: 9pt; font-weight: 800; color: #E62117; margin: 0 0 4px; letter-spacing: 0.03em; }
  .terms-main-title { font-size: 11pt !important; margin: 0 0 4px !important; color: #111 !important; text-transform: uppercase; letter-spacing: 0.06em; border: none !important; }
  .terms-sub { font-size: 7pt; color: #666; margin: 0; }
  .terms-intro { margin: 8px 0 10px; font-size: 7.5pt; text-align: justify; }
  .terms-section { margin-bottom: 6px; page-break-inside: avoid; }
  .terms-section h2 { font-size: 8pt !important; color: #E62117 !important; margin: 6px 0 2px !important; padding: 0 !important; border: none !important; text-transform: none !important; letter-spacing: 0; }
  .terms-section p { margin: 0 0 4px; text-align: justify; }
  .terms-section ul { margin: 2px 0 4px 14px; padding: 0; }
  .terms-section li { margin-bottom: 2px; text-align: justify; }
  .terms-contact { margin-top: 8px; font-size: 7pt; text-align: center; }
  .page-break-before { page-break-before: always; break-before: page; }
  .page-indicator { text-align: center; margin-top: 6px; font-size: 7pt; }
  .doc-page-1 .doc-footer { margin-top: auto; }
`;
