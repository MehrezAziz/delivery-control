"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DocumentData {
  id: string;
  verificationStatus: string;
  firstName: string | null;
  lastName: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  selfieVerified: boolean;
  documentImage: string | null;
  selfieImage: string | null;
  docImageTop: string | null;
  docImageBottom: string | null;
}

function DocImage({ src, alt }: { src: string; alt: string }) {
  // Convert backend path like "uploads\xxx.jpg" to our proxy URL
  const url = `/api/images/${src.replace(/\\/g, "/")}`;
  return (
    <div className="relative border rounded overflow-hidden bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="object-contain w-full max-h-[300px]" />
    </div>
  );
}

export default function DriverDocumentsViewer({ driverId, hasVerification }: { driverId: string; hasVerification: boolean }) {
  const [documents, setDocuments] = useState<DocumentData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchDocuments() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/drivers/${driverId}/documents`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load"); return; }
      setDocuments(data.documents);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  if (!hasVerification) {
    return (
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No verification documents submitted.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        {documents === null && (
          <Button onClick={fetchDocuments} disabled={loading} variant="outline" size="sm">
            {loading ? "Loading..." : "See Documents"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {documents === null && !loading && (
          <p className="text-muted-foreground text-sm">Click "See Documents" to load verification documents.</p>
        )}

        {documents && documents.length === 0 && (
          <p className="text-muted-foreground text-sm">No documents found.</p>
        )}

        {documents && documents.map(doc => (
          <div key={doc.id} className="border rounded p-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Status:</span> <Badge className="ml-1">{doc.verificationStatus}</Badge></div>
              <div><span className="text-muted-foreground">Name:</span> {doc.firstName} {doc.lastName}</div>
              <div><span className="text-muted-foreground">ID Number:</span> {doc.idNumber || "-"}</div>
              <div><span className="text-muted-foreground">Date of Birth:</span> {doc.dateOfBirth || "-"}</div>
              <div><span className="text-muted-foreground">Address:</span> {doc.address || "-"}</div>
              <div><span className="text-muted-foreground">Selfie Verified:</span> {doc.selfieVerified ? "Yes" : "No"}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {doc.selfieImage && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Selfie</p>
                  <DocImage src={doc.selfieImage} alt="Selfie" />
                </div>
              )}
              {doc.documentImage && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Document</p>
                  <DocImage src={doc.documentImage} alt="Document" />
                </div>
              )}
              {doc.docImageTop && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Document (Front)</p>
                  <DocImage src={doc.docImageTop} alt="Document Front" />
                </div>
              )}
              {doc.docImageBottom && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Document (Back)</p>
                  <DocImage src={doc.docImageBottom} alt="Document Back" />
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
