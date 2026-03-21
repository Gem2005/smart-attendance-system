import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	turbopack: {
		root: path.resolve(__dirname, "../.."),
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "eohrufcxrdflbxdrzsdm.supabase.co",
				port: "",
				pathname: "/storage/v1/object/sign/attendance-proofs/**",
			}
		]
	}
};

export default nextConfig;
