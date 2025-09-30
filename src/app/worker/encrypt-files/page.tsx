
"use client";

import React, { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileLock, Loader2, CheckCircle, XCircle, Key, Copy, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type EncryptedFile = {
  original_file: string;
  encrypted_file?: string;
  backup_file?: string;
  status: "success" | "error";
  error?: string;
  file_size: number;
  encrypted_at: string;
  file_type: string;
};

type MasterKeyInfo = {
  key_base64: string;
  created_at: string;
  algorithm: string;
};

type EncryptionResponse = {
  status: "success" | "error";
  message: string;
  scanned_count: number;
  master_key_info: MasterKeyInfo;
  newly_encrypted_files: EncryptedFile[];
};

export default function EncryptFilesPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<EncryptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEncrypt = () => {
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch("http://localhost:5430/api/v1/files/encrypt_top_10", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Encryption process failed to start.");
        }

        setResult(data);
        toast({
          title: "Encryption Complete",
          description: data.message,
        });
      } catch (e: any) {
        console.error("Encryption process failed:", e);
        setError(e.message || "An unknown error occurred while communicating with the encryption service.");
        toast({
          variant: "destructive",
          title: "Encryption Failed",
          description: e.message,
        });
      }
    });
  };

  const handleCopyKey = () => {
      if (!result?.master_key_info.key_base64) return;
      navigator.clipboard.writeText(result.master_key_info.key_base64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileLock className="h-6 w-6" />
            Encrypt Top Priority Files
          </CardTitle>
          <CardDescription>
            Scan for the top 10 most critical, unprotected files and encrypt them
            using AES-256-GCM. A new master key will be generated for this batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Click the button below to start the encryption process. The system
            will automatically identify and secure the highest priority files.
            Ensure the encryption service on port 5430 is running.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleEncrypt} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Encrypting...</span>
              </>
            ) : (
              <>
                <FileLock className="mr-2 h-4 w-4" />
                Scan and Encrypt Files
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {isPending && (
         <div className="flex items-center justify-center gap-2 text-muted-foreground p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-lg">Scanning and encrypting files, please wait...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
            <XCircle className="h-4 w-4"/>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
            <CardHeader>
                <CardTitle>Encryption Report</CardTitle>
                <CardDescription>{result.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Master Key Info */}
                <div className="p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold flex items-center gap-2 mb-2"><Key/> Master Key Generated</h3>
                    <p className="text-sm text-muted-foreground">
                        This key is required to decrypt the files from this batch. 
                        <strong className="text-destructive"> Store it in a secure location immediately.</strong>
                    </p>
                    <div className="flex items-center gap-2 mt-3 p-3 bg-background border rounded-md">
                        <code className="text-sm font-mono flex-grow break-all">{result.master_key_info.key_base64}</code>
                        <Button variant="ghost" size="icon" onClick={handleCopyKey}>
                           {copied ? <Check className="h-4 w-4 text-green-500"/> : <Copy className="h-4 w-4"/>}
                           <span className="sr-only">Copy key</span>
                        </Button>
                    </div>
                     <p className="text-xs text-muted-foreground mt-2">
                        Algorithm: {result.master_key_info.algorithm} | Created: {new Date(result.master_key_info.created_at).toLocaleString()}
                    </p>
                </div>

                {/* File Processing Details */}
                <div>
                     <h3 className="font-semibold mb-2">File Processing Details</h3>
                     <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Size</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.newly_encrypted_files.map((file, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="font-medium truncate" title={file.original_file}>
                                                {file.original_file.split('/').pop()}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {file.status === "success" ? "Encrypted to .enc, backup created" : "Failed to encrypt"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {file.status === "success" ? (
                                                <Badge className="bg-green-600 hover:bg-green-700">
                                                    <CheckCircle className="mr-1 h-3 w-3"/>
                                                    Success
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                     <XCircle className="mr-1 h-3 w-3"/>
                                                     Error
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                           {(file.file_size / 1024).toFixed(2)} KB
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
