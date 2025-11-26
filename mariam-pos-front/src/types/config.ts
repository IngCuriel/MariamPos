export interface Config  { 
  mode?: "server" | "client" | "auto";
  apiUrl: string;
  serverUrl?: string;
  sucursal: string;
  caja: string;
  autoDetect?: boolean;
}