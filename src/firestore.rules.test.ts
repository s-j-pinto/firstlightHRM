/**
 * @jest-environment node
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as fs from "fs";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Set up the test environment.
  // `firebase emulators:exec` automatically sets the FIRESTORE_EMULATOR_HOST
  // environment variable, so we don't need to specify host and port.
  testEnv = await initializeTestEnvironment({
    projectId: "firstlighthomecare-hrm",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  // Tearing down the test environment
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  // Clear the database before each test
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});


describe("Firestore security rules", () => {
  describe("settings collection", () => {

    it("should allow an admin to write to the settings collection", async () => {
      // Simulate an authenticated admin user by setting the `isAdmin` custom claim
      const adminContext = testEnv.authenticatedContext("admin_user", { isAdmin: true });
      const db = adminContext.firestore();

      // Attempt to write to a document in the settings collection
      const settingsRef = doc(db, "settings/availability");
      await assertSucceeds(setDoc(settingsRef, { sunday_slots: "10:00,11:00" }));
    });

    it("should deny a non-admin user from writing to the settings collection", async () => {
      // Simulate a regular authenticated user (no custom claims)
      const userContext = testEnv.authenticatedContext("regular_user");
      const db = userContext.firestore();

      // Attempt to write to a document in the settings collection
      const settingsRef = doc(db, "settings/availability");
      await assertFails(setDoc(settingsRef, { sunday_slots: "10:00,11:00" }));
    });

    it("should deny an unauthenticated user from writing to the settings collection", async () => {
      // Simulate an unauthenticated user
      const unauthedContext = testEnv.unauthenticatedContext();
      const db = unauthedContext.firestore();

      // Attempt to write to a document in the settings collection
      const settingsRef = doc(db, "settings/availability");
      await assertFails(setDoc(settingsRef, { sunday_slots: "10:00,11:00" }));
    });

    it("should allow any user to read from the settings collection", async () => {
        // Set up some data as an admin first, so the document exists
        const adminContext = testEnv.authenticatedContext("admin_user", { isAdmin: true });
        await setDoc(doc(adminContext.firestore(), "settings/availability"), { sunday_slots: "10:00,11:00" });
        
        // Unauthenticated read should succeed
        const unauthedContext = testEnv.unauthenticatedContext();
        let db = unauthedContext.firestore();
        let settingsRef = doc(db, "settings/availability");
        await assertSucceeds(getDoc(settingsRef));

        // Authenticated non-admin read should succeed
        const userContext = testEnv.authenticatedContext("regular_user");
        db = userContext.firestore();
        settingsRef = doc(db, "settings/availability");
        await assertSucceeds(getDoc(settingsRef));
    });

  });
});
