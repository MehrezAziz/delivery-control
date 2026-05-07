import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Local Smart Delivery",
  description:
    "Politique de confidentialité de l’application mobile Local Smart Delivery (caméra, notifications, données personnelles).",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">
        Politique de confidentialité
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Application mobile <strong>Local Smart Delivery</strong> (Android / iOS) —{" "}
        <span className="font-mono text-xs">com.localsmartdelivery.app</span>
      </p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-medium">1. Responsable du traitement</h2>
          <p>
            Les données liées à l’utilisation de l’application sont traitées dans le cadre du service de livraison{" "}
            <strong>Local Smart Delivery</strong>. Pour toute question : contactez le support via les canaux indiqués
            sur votre contrat ou sur le site officiel du service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">2. Données collectées et finalités</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Compte et commandes :</strong> informations nécessaires à la création du compte, au suivi des
              livraisons et au support (identité, coordonnées, historique de commande, selon les fonctionnalités
              activées).
            </li>
            <li>
              <strong>Caméra :</strong> l’application peut accéder à la caméra uniquement lorsque cela est nécessaire
              (par exemple vérification d’identité ou contrôle de vivacité), avec votre consentement explicite via la
              boîte de dialogue du système. Les traitements sont limités à ces finalités.
            </li>
            <li>
              <strong>Notifications :</strong> envoi d’alertes liées à votre commande ou à votre compte ; vous pouvez
              désactiver les notifications dans les réglages de l’appareil.
            </li>
            <li>
              <strong>Authentification locale (biométrie) :</strong> si vous l’activez, le système peut utiliser les
              mécanismes biométriques de l’appareil pour déverrouiller l’application ; les données biométriques ne sont pas
              stockées par l’application sur nos serveurs.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">3. Base légale</h2>
          <p>
            Exécution du contrat de transport / livraison, intérêt légitime pour la sécurité du service, et lorsque
            requis votre consentement (caméra, notifications push, etc.), conformément au RGPD et aux lois applicables.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">4. Conservation</h2>
          <p>
            Les données sont conservées pendant la durée nécessaire aux finalités décrites et aux obligations légales
            (comptabilité, litiges). Des durées plus courtes peuvent s’appliquer à certaines données techniques.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">5. Partage</h2>
          <p>
            Les données peuvent être transmises aux prestataires strictement nécessaires au fonctionnement du service
            (hébergement, cartographie, messagerie, analyses d’incidents), dans le respect des engagements de
            confidentialité et de sécurité. Nous ne vendons pas vos données personnelles.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">6. Vos droits</h2>
          <p>
            Selon votre lieu de résidence, vous pouvez disposer d’un droit d’accès, de rectification, d’effacement, de
            limitation, d’opposition et de portabilité. Contactez-nous pour exercer ces droits. Vous pouvez aussi
            introduire une réclamation auprès d’une autorité de protection des données.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">7. Sécurité</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données
            contre l’accès non autorisé, la perte ou l’altération.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-medium">8. Modifications</h2>
          <p>
            Cette politique peut être mise à jour. La date de dernière mise à jour sera indiquée ci-dessous. En cas de
            changement important, nous vous en informerons par les moyens appropriés.
          </p>
          <p className="mt-2 text-muted-foreground">Dernière mise à jour : 6 mai 2026</p>
        </div>
      </section>
    </main>
  );
}
