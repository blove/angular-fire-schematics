export interface Schema {
  /** Firebase API key. */
  apiKey: string;

  /** Firebase authorized domain. */
  authDomain: string;

  /** Firebase db URL. */
  databaseURL: string;

  /** Name of the project to target. */
  project: string;

  /** Firebase project ID. */
  projectId: string;

  /** Firebase storage bucket. */
  storageBucket: string;

  /** Firebase messaging sender ID. */
  messagingSenderId: string;
}
