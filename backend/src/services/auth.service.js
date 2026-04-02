import { User } from "../models/user.models.js";

export const upsertUserFromFirebase = async (decodedToken) => {
  const firebaseUid = decodedToken.uid;

  const user = await User.findOneAndUpdate(
    { firebaseUid },
    {
      $set: {
        email: decodedToken.email || null,
        displayName: decodedToken.name || null,
        photoURL: decodedToken.picture || null,
        lastLoginAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return user;
};
