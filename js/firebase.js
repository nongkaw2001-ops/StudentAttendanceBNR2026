(function initFirebase(global) {
    if (!global.firebase || !global.AppConfig) {
        throw new Error("Firebase SDK or AppConfig was not loaded.");
    }

    const app = global.firebase.initializeApp(global.AppConfig.firebase);

    global.AppFirebase = {
        app,
        auth: global.firebase.auth(),
        db: global.firebase.database()
    };
})(window);
