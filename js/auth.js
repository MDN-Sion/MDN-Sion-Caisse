"use strict";

/* ============================================================
   MDN SION - AUTHENTIFICATION COMMUNE
   Fichier : js/auth.js

   Rôles techniques de la base :
   - utilisateur
   - responsable
   - administrateur

   Ce fichier centralise :
   - la récupération de la session Supabase ;
   - la récupération du profil interne MDN ;
   - la vérification du compte actif ;
   - la vérification du rôle ;
   - les fonctions de contrôle des droits ;
   - la déconnexion ;
   - la redirection vers la connexion.
   ============================================================ */

(function () {

  const ROLES_AUTORISES = [
    "utilisateur",
    "responsable",
    "administrateur"
  ];

  let utilisateurCourant = null;
  let profilCourant = null;


  /* ============================================================
     OUTILS
     ============================================================ */

  function obtenirClientSupabase() {
    const client = window.MDN_SUPABASE;

    if (!client) {
      throw new Error(
        "Le client Supabase MDN n'est pas disponible."
      );
    }

    return client;
  }


  function normaliserRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase();
  }


  function libelleRole(role) {
    switch (normaliserRole(role)) {

      case "administrateur":
        return "Administrateur";

      case "responsable":
        return "Responsable";

      case "utilisateur":
        return "Utilisateur";

      default:
        return "Utilisateur";
    }
  }


  function urlConnexion() {
    return "connexion.html";
  }


  function redirigerVersConnexion() {
    window.location.replace(urlConnexion());
  }


  /* ============================================================
     SESSION SUPABASE
     ============================================================ */

  async function obtenirSession() {

    const client = obtenirClientSupabase();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.session ||
      !data.session.user
    ) {
      return null;
    }

    return data.session;
  }


  /* ============================================================
     PROFIL INTERNE MDN
     ============================================================ */

  async function obtenirProfil(utilisateurAuth) {

    if (!utilisateurAuth || !utilisateurAuth.id) {
      throw new Error(
        "Utilisateur Supabase invalide."
      );
    }

    const client = obtenirClientSupabase();

    const {
      data: profil,
      error
    } = await client
      .from("utilisateurs")
      .select(
        "id, auth_user_id, email, role, actif"
      )
      .eq(
        "auth_user_id",
        utilisateurAuth.id
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!profil) {
      throw new Error(
        "Aucun compte interne MDN n'est associé à cet utilisateur."
      );
    }

    if (profil.actif !== true) {
      throw new Error(
        "Votre compte MDN est désactivé. Contactez un administrateur."
      );
    }

    const role = normaliserRole(profil.role);

    if (!ROLES_AUTORISES.includes(role)) {
      throw new Error(
        "Le rôle de votre compte MDN n'est pas valide."
      );
    }

    profil.role = role;

    return profil;
  }


  /* ============================================================
     INITIALISATION AUTHENTIFICATION
     ============================================================ */

  async function verifierAuthentification(options = {}) {

    const {
      redirigerSiNonConnecte = true,
      deconnecterSiProfilInvalide = true
    } = options;

    const client = obtenirClientSupabase();

    const session = await obtenirSession();

    if (!session) {

      utilisateurCourant = null;
      profilCourant = null;

      if (redirigerSiNonConnecte) {
        redirigerVersConnexion();
      }

      return null;
    }

    utilisateurCourant = session.user;

    try {

      profilCourant = await obtenirProfil(
        utilisateurCourant
      );

    } catch (erreur) {

      profilCourant = null;

      if (deconnecterSiProfilInvalide) {

        try {
          await client.auth.signOut();
        } catch (erreurDeconnexion) {
          console.error(
            "[MDN Sion] Impossible de fermer la session invalide :",
            erreurDeconnexion
          );
        }
      }

      throw erreur;
    }

    return {
      session: session,
      utilisateur: utilisateurCourant,
      profil: profilCourant,
      role: profilCourant.role,
      libelleRole: libelleRole(profilCourant.role)
    };
  }


  /* ============================================================
     DROITS
     ============================================================ */

  function estUtilisateur(role) {

    const roleNormalise = normaliserRole(
      role !== undefined
        ? role
        : profilCourant?.role
    );

    return roleNormalise === "utilisateur";
  }


  function estResponsable(role) {

    const roleNormalise = normaliserRole(
      role !== undefined
        ? role
        : profilCourant?.role
    );

    return roleNormalise === "responsable";
  }


  function estAdministrateur(role) {

    const roleNormalise = normaliserRole(
      role !== undefined
        ? role
        : profilCourant?.role
    );

    return roleNormalise === "administrateur";
  }


  function estResponsableOuAdministrateur(role) {

    const roleNormalise = normaliserRole(
      role !== undefined
        ? role
        : profilCourant?.role
    );

    return (
      roleNormalise === "responsable" ||
      roleNormalise === "administrateur"
    );
  }


  function aUnDesRoles(rolesAutorises, role) {

    if (!Array.isArray(rolesAutorises)) {
      return false;
    }

    const roleNormalise = normaliserRole(
      role !== undefined
        ? role
        : profilCourant?.role
    );

    return rolesAutorises
      .map(normaliserRole)
      .includes(roleNormalise);
  }


  /* ============================================================
     PROTECTION D'UNE PAGE PAR RÔLE
     ============================================================ */

  async function protegerPage(rolesAutorises = null) {

    const auth = await verifierAuthentification();

    if (!auth) {
      return null;
    }

    if (
      Array.isArray(rolesAutorises) &&
      rolesAutorises.length > 0
    ) {

      const autorise = aUnDesRoles(
        rolesAutorises,
        auth.role
      );

      if (!autorise) {

        console.warn(
          "[MDN Sion] Accès refusé pour le rôle :",
          auth.role
        );

        window.location.replace("accueil.html");

        return null;
      }
    }

    return auth;
  }


  /* ============================================================
     DÉCONNEXION
     ============================================================ */

  async function deconnexion() {

    const client = obtenirClientSupabase();

    try {

      const {
        error
      } = await client.auth.signOut();

      if (error) {
        throw error;
      }

    } catch (erreur) {

      console.error(
        "[MDN Sion] Erreur de déconnexion :",
        erreur
      );

    } finally {

      utilisateurCourant = null;
      profilCourant = null;

      redirigerVersConnexion();
    }
  }


  /* ============================================================
     ÉCOUTE DES CHANGEMENTS DE SESSION
     ============================================================ */

  function surveillerSession(options = {}) {

    const {
      redirigerApresDeconnexion = true
    } = options;

    const client = obtenirClientSupabase();

    return client.auth.onAuthStateChange(
      function (evenement, session) {

        if (
          evenement === "SIGNED_OUT" ||
          !session
        ) {

          utilisateurCourant = null;
          profilCourant = null;

          if (redirigerApresDeconnexion) {
            redirigerVersConnexion();
          }

          return;
        }

        if (
          session &&
          session.user
        ) {
          utilisateurCourant = session.user;
        }
      }
    );
  }


  /* ============================================================
     INFORMATIONS UTILISATEUR COURANT
     ============================================================ */

  function getUtilisateurCourant() {
    return utilisateurCourant;
  }


  function getProfilCourant() {
    return profilCourant;
  }


  function getRoleCourant() {

    if (!profilCourant) {
      return null;
    }

    return normaliserRole(
      profilCourant.role
    );
  }


  /* ============================================================
     API GLOBALE MDN
     ============================================================ */

  window.MDN_AUTH = {

    verifierAuthentification:
      verifierAuthentification,

    protegerPage:
      protegerPage,

    obtenirSession:
      obtenirSession,

    obtenirProfil:
      obtenirProfil,

    deconnexion:
      deconnexion,

    surveillerSession:
      surveillerSession,

    normaliserRole:
      normaliserRole,

    libelleRole:
      libelleRole,

    estUtilisateur:
      estUtilisateur,

    estResponsable:
      estResponsable,

    estAdministrateur:
      estAdministrateur,

    estResponsableOuAdministrateur:
      estResponsableOuAdministrateur,

    aUnDesRoles:
      aUnDesRoles,

    getUtilisateurCourant:
      getUtilisateurCourant,

    getProfilCourant:
      getProfilCourant,

    getRoleCourant:
      getRoleCourant

  };

})();
