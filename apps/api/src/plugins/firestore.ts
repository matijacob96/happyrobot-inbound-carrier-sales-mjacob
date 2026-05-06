import fp from "fastify-plugin";
import {
  initializeApp,
  applicationDefault,
  getApps,
  type App,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

declare module "fastify" {
  interface FastifyInstance {
    db: Firestore;
  }
}

interface FirestorePluginOptions {
  projectId: string;
  emulatorHost?: string;
}

export default fp<FirestorePluginOptions>(
  async function firestorePlugin(app, opts) {
    if (opts.emulatorHost) {
      process.env.FIRESTORE_EMULATOR_HOST = opts.emulatorHost;
      app.log.info(
        { emulator: opts.emulatorHost },
        "firestore: using local emulator",
      );
    }

    let firebaseApp: App;
    if (getApps().length > 0) {
      firebaseApp = getApps()[0]!;
    } else {
      // With FIRESTORE_EMULATOR_HOST set, firebase-admin skips credential
      // verification — passing only projectId is the supported recipe.
      const useEmulator = Boolean(opts.emulatorHost);
      firebaseApp = initializeApp(
        useEmulator
          ? { projectId: opts.projectId }
          : { projectId: opts.projectId, credential: applicationDefault() },
      );
    }

    const db = getFirestore(firebaseApp);
    db.settings({ ignoreUndefinedProperties: true });

    app.decorate("db", db);

    app.addHook("onClose", async () => {
      // firebase-admin manages its own connection lifecycle, nothing to close.
    });
  },
  { name: "firestore" },
);
