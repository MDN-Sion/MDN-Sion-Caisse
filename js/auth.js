"use strict";

/* ============================================================
   MDN SION - AUTHENTIFICATION COMMUNE
   Fichier : js/auth.js

   Rôles techniques :
   - utilisateur
   - responsable
   - administrateur
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
     CLIENT SUPABASE
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


  /* ============================================================
     ROLES
     ============================================================ */

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


  /* ============================================================
     REDIRECTION CONNEXION
     ============================================================ */

  function redirigerVersConnexion() {

    window.location.replace(
      "connexion.html"
    );

  }


  /* ============================================================
     SESSION SUPABASE
     ============================================================ */

  async function obtenirSession() {

    const client =
      obtenirClientSupabase();


    const {
      data,
      error
    } =
      await client.auth.getSession();


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
     MODE DEMO
     ============================================================ */

  async function obtenirEtatSessionDemo() {

    const client =
      obtenirClientSupabase();


    const {
      data,
      error
    } =
      await client.rpc(
        "etat_session_demo"
      );


    if (error) {
      throw error;
    }


    return data || null;

  }


  async function estSessionDemo() {

    const etat =
      await obtenirEtatSessionDemo();


    return Boolean(
      etat &&
      etat.authentifie === true &&
      etat.mode_demo === true
    );

  }


  /* ============================================================
     PROFIL INTERNE MDN
     ============================================================ */

  async function obtenirProfil(
    utilisateurAuth
  ) {

    if (
      !utilisateurAuth ||
      !utilisateurAuth.id
    ) {

      throw new Error(
        "Utilisateur Supabase invalide."
      );

    }


    const client =
      obtenirClientSupabase();


    /*
     * On récupère :
     *
     * - id
     * - auth_user_id
     * - email
     * - prenom
     * - nom
     * - role
     * - actif
     * - is_demo
     *
     * is_demo permet de distinguer le compte
     * technique dédié au mode Démo des comptes réels.
     */

    const {
      data: profil,
      error
    } =
      await client
        .from("utilisateurs")
        .select(
          "id, auth_user_id, email, prenom, nom, role, actif, is_demo"
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


    if (
      profil.actif !== true
    ) {

      throw new Error(
        "Votre compte MDN est désactivé. Contactez un administrateur."
      );

    }


    const role =
      normaliserRole(
        profil.role
      );


    if (
      !ROLES_AUTORISES.includes(
        role
      )
    ) {

      throw new Error(
        "Le rôle de votre compte MDN n'est pas valide."
      );

    }


    /*
     * On conserve toujours le rôle sous sa
     * forme technique normalisée :
     *
     * utilisateur
     * responsable
     * administrateur
     */

    profil.role =
      role;


    return profil;

  }


  /* ============================================================
     VERIFICATION COMPLETE DE L'AUTHENTIFICATION
     ============================================================ */

  async function verifierAuthentification(
    options = {}
  ) {

    const {

      redirigerSiNonConnecte = true,

      deconnecterSiProfilInvalide = true

    } = options;


    const client =
      obtenirClientSupabase();


    const session =
      await obtenirSession();


    /*
     * Aucune session Supabase.
     */

    if (!session) {

      utilisateurCourant =
        null;

      profilCourant =
        null;


      if (
        redirigerSiNonConnecte
      ) {

        redirigerVersConnexion();

      }


      return null;

    }


    utilisateurCourant =
      session.user;


    /*
     * On demande au serveur si la session
     * actuellement ouverte est la session
     * dédiée au mode Démo.
     *
     * On ne se fie pas à une variable JavaScript
     * ou à un paramètre placé dans l'URL.
     */

    const etatSessionDemo =
      await obtenirEtatSessionDemo();


    const modeDemo =
      Boolean(
        etatSessionDemo &&
        etatSessionDemo.authentifie === true &&
        etatSessionDemo.mode_demo === true
      );


    /*
     * Recherche du profil interne MDN.
     */

    try {

      profilCourant =
        await obtenirProfil(
          utilisateurCourant
        );

    } catch (erreur) {

      profilCourant =
        null;


      /*
       * Si le compte interne MDN est invalide,
       * désactivé ou possède un rôle incorrect,
       * on ferme également la session Supabase.
       */

      if (
        deconnecterSiProfilInvalide
      ) {

        try {

          await client.auth.signOut();

        } catch (
          erreurDeconnexion
        ) {

          console.error(
            "[MDN Sion] Impossible de fermer la session invalide :",
            erreurDeconnexion
          );

        }

      }


      throw erreur;

    }


    /*
     * Objet commun retourné aux différentes
     * pages de l'application.
     *
     * modeDemo vaut :
     *
     * true  = session Démo dédiée
     * false = session réelle
     */

    return {

      session:
        session,

      utilisateur:
        utilisateurCourant,

      profil:
        profilCourant,

      role:
        profilCourant.role,

      libelleRole:
        libelleRole(
          profilCourant.role
        ),

      modeDemo:
        modeDemo,

      etatSessionDemo:
        etatSessionDemo

    };

  }


  /* ============================================================
     CONTROLE DES ROLES
     ============================================================ */

  function estUtilisateur(
    role
  ) {

    return normaliserRole(

      role !== undefined
        ? role
        : profilCourant?.role

    ) === "utilisateur";

  }


  function estResponsable(
    role
  ) {

    return normaliserRole(

      role !== undefined
        ? role
        : profilCourant?.role

    ) === "responsable";

  }


  function estAdministrateur(
    role
  ) {

    return normaliserRole(

      role !== undefined
        ? role
        : profilCourant?.role

    ) === "administrateur";

  }


  function estResponsableOuAdministrateur(
    role
  ) {

    const roleNormalise =
      normaliserRole(

        role !== undefined
          ? role
          : profilCourant?.role

      );


    return (

      roleNormalise ===
        "responsable"

      ||

      roleNormalise ===
        "administrateur"

    );

  }


  function aUnDesRoles(
    rolesAutorises,
    role
  ) {

    if (
      !Array.isArray(
        rolesAutorises
      )
    ) {

      return false;

    }


    const roleNormalise =
      normaliserRole(

        role !== undefined
          ? role
          : profilCourant?.role

      );


    return rolesAutorises
      .map(
        normaliserRole
      )
      .includes(
        roleNormalise
      );

  }


  /* ============================================================
     PROTECTION D'UNE PAGE
     ============================================================ */

  async function protegerPage(
    rolesAutorises = null
  ) {

    const auth =
      await verifierAuthentification();


    if (!auth) {
      return null;
    }


    /*
     * Si aucun tableau de rôles n'est fourni,
     * tout utilisateur MDN authentifié et actif
     * peut accéder à la page.
     */

    if (

      Array.isArray(
        rolesAutorises
      )

      &&

      rolesAutorises.length > 0

      &&

      !aUnDesRoles(
        rolesAutorises,
        auth.role
      )

    ) {

      console.warn(
        "[MDN Sion] Accès refusé pour le rôle :",
        auth.role
      );


      window.location.replace(
        "accueil.html"
      );


      return null;

    }


    return auth;

  }


  /* ============================================================
     DECONNEXION
     ============================================================ */

  async function deconnexion() {

    const client =
      obtenirClientSupabase();


    try {

      const {
        error
      } =
        await client.auth.signOut();


      if (error) {
        throw error;
      }


    } catch (erreur) {

      console.error(
        "[MDN Sion] Erreur de déconnexion :",
        erreur
      );


    } finally {

      utilisateurCourant =
        null;

      profilCourant =
        null;


      redirigerVersConnexion();

    }

  }


  /* ============================================================
     SURVEILLANCE DE LA SESSION
     ============================================================ */

  function surveillerSession(
    options = {}
  ) {

    const {

      redirigerApresDeconnexion =
        true

    } = options;


    const client =
      obtenirClientSupabase();


    return client.auth
      .onAuthStateChange(

        function (
          evenement,
          session
        ) {

          /*
           * Session fermée.
           */

          if (

            evenement ===
              "SIGNED_OUT"

            ||

            !session

          ) {

            utilisateurCourant =
              null;

            profilCourant =
              null;


            if (
              redirigerApresDeconnexion
            ) {

              redirigerVersConnexion();

            }


            return;

          }


          /*
           * Session toujours active.
           */

          if (
            session &&
            session.user
          ) {

            utilisateurCourant =
              session.user;

          }

        }

      );

  }


  /* ============================================================
     INFORMATIONS DE L'UTILISATEUR COURANT
     ============================================================ */

  function getUtilisateurCourant() {

    return utilisateurCourant;

  }


  function getProfilCourant() {

    return profilCourant;

  }


  function getRoleCourant() {

    return profilCourant

      ? normaliserRole(
          profilCourant.role
        )

      : null;

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

    obtenirEtatSessionDemo:
      obtenirEtatSessionDemo,

    estSessionDemo:
      estSessionDemo,

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
