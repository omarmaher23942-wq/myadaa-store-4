// uploadthing-client.ts
import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from "@uploadthing/react";
import type { AppFileRouter } from "@/app/api/uploadthing/core";
export const UploadButton = generateUploadButton<AppFileRouter>();
export const UploadDropzone = generateUploadDropzone<AppFileRouter>();
export const { useUploadThing } = generateReactHelpers<AppFileRouter>();
