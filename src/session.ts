export type AdminUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "EDITOR";
};
