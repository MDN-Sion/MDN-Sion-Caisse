// ============================================================
// MDN SION
// Initialisation du client Supabase
// ============================================================

"use strict";

(function () {

  // ----------------------------------------------------------
  // Vérification de la configuration
  // ----------------------------------------------------------

  if (!window.MDN_CONFIG) {
    throw new Error(
      "Configuration MDN_CONFIG introuvable. Vérifie le chargement de js/config.js."
    );
  }

  const supabaseUrl =
    window.MDN_CONFIG.SUPABASE_URL;

  const supabasePublishableKey =
    window.MDN_CONFIG.SUPABASE_PUBLISHABLE_KEY;


  if (
    !supabaseUrl ||
    typeof supabaseUrl !== "string"
  ) {
    throw new Error(
      "SUPABASE_URL est absente ou invalide."
    );
  }


  if (
    !supabasePublishableKey ||
    typeof supabasePublishableKey !== "string" ||
    supabasePublishableKey === "COLLE_ICI_TA_PUBLISHABLE_KEY"
  ) {
    throw new Error(
      "La Publishable key Supabase n'a pas été configurée."
    );
  }


  // ----------------------------------------------------------
  // Vérification de la bibliothèque Supabase
  // ----------------------------------------------------------

  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    throw new Error(
      "La bibliothèque Supabase JavaScript n'est pas chargée."
    );
  }


  // ----------------------------------------------------------
  // Création du client
  // ----------------------------------------------------------

  const client = window.supabase.createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {

        // Conserve la connexion après fermeture/réouverture.
        persistSession: true,

        // Renouvelle automatiquement le jeton de connexion.
        autoRefreshToken: true,

        // Permet à Supabase de détecter une session présente
        // dans l'URL lorsqu'un flux d'authentification l'exige.
        detectSessionInUrl: true,

        // Clé propre à l'application MDN Sion.
        storageKey: "mdn-sion-auth"
      }
    }
  );


  // ----------------------------------------------------------
  // Mise à disposition du client dans l'application
  // ----------------------------------------------------------
  //
  // Tous les autres fichiers JavaScript utiliseront :
  //
  // window.MDN_SUPABASE
  //
  // Nous évitons ainsi de recréer plusieurs clients Supabase.
  // ----------------------------------------------------------

  Object.defineProperty(
    window,
    "MDN_SUPABASE",
    {
      value: client,
      writable: false,
      configurable: false
    }
  );


  // ----------------------------------------------------------
  // Information de développement
  // ----------------------------------------------------------

  console.info(
    "[MDN Sion] Client Supabase initialisé."
  );

})();
