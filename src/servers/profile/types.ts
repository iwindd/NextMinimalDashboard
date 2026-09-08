export type Profile = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "EDITOR";
  createdAt: string;
  updatedAt: string;
};
