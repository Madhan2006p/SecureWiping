
"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HardDrive,
  Shield,
  CheckCircle,
  XCircle,
  Loader,
  ChevronRight,
  ChevronLeft,
  Info,
  Sparkles,
  ShieldQuestion,
  KeyRound,
  Bomb,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AiSuggestionForm from "@/components/ai-suggestion-form";
import { useToast } from "@/hooks/use-toast";


type Device = {
  id: string;
  name: string;
  size: string;
};

const wipeMethods = [
  {
    id: "single",
    name: "Single Pass",
    description: "Fastest. Overwrites data once. Good for non-sensitive data.",
  },
  {
    id: "dod",
    name: "DoD 3-Pass",
    description:
      "Secure. Meets U.S. Dept. of Defense standards. Good balance.",
  },
  {
    id: "gutmann",
    name: "Gutmann 35-Pass",
    description:
      "Most secure & slowest. Overwrites data 35 times. For highly sensitive data.",
  },
  {
    id: "boom-wipe",
    name: "💣 Boom Wipe",
    Icon: Bomb,
    description: "High-intensity parallel data destruction. Places memory bombs across device sectors for maximum security with real-time progress tracking."
  },
  {
    id: "encrypt-and-wipe",
    name: "Secure Encrypt-and-Wipe",
    Icon: KeyRound,
    description: "Encrypts the drive with a temporary key, then destroys the key, rendering data unrecoverable."
  }
];

function WipePageComponent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const deviceNameFromQuery = searchParams.get("device");

  const [step, setStep] = useState(1);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(
    deviceNameFromQuery || undefined
  );
  const [selectedMethod, setSelectedMethod] = useState("dod");
  const [email, setEmail] = useState("test@example.com");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeComplete, setWipeComplete] = useState(false);
  const [wipeSuccess, setWipeSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDevices() {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:9758/api/devices', { cache: 'no-store' });
        if (!res.ok) {
           throw new Error('Failed to fetch devices');
        }
        const data = await res.json();
        setDevices(data.map((d: any) => ({id: d.name, name: `${d.name} (${d.size})`, size: d.size})));
      } catch (error) {
        console.error("Failed to fetch devices:", error);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, []);

  const selectedDeviceDetails = useMemo(() => {
    return devices.find((d) => d.name === selectedDevice);
  }, [selectedDevice, devices]);

  const handleStartWipe = async () => {
    if (!selectedDeviceDetails) return;

    setStep(3);
    setIsWiping(true);
    setProgress(0);
    setWipeComplete(false);
    setWipeSuccess(false);
    setReportId(null);
    setLogs(["Wipe process initiated..."]);
    setLogs(prev => [...prev, `Calling verification API on port 5000 with method: ${selectedMethod}`]);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 1, 99));
    }, 200);

    try {
        const response = await fetch('http://localhost:5000/api/verify-and-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folderPath: "/", // Using root path for simulation as per API docs
                wipeMethod: selectedMethod,
                receiverEmail: email,
                deviceName: selectedDeviceDetails.name,
                deviceSerial: `SN-SIM-${selectedDeviceDetails.id.substring(0,10)}`, // Simulated serial
                deviceType: selectedDeviceDetails.id, // Assuming ID is type
            })
        });
        
        clearInterval(progressInterval);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Verification API failed");
        }

        setLogs(prev => [...prev, `API Response: Wipe success -> ${result.success}`]);
        setLogs(prev => [...prev, `Files Verified: ${result.totalHashesChecked}`]);
        setLogs(prev => [...prev, `Failed Wipes (Hashes Found): ${result.failedWipes}`]);
        
        setWipeSuccess(result.success);
        
        if (result.success && result.certificate) {
            setReportId(result.certificate.shortId || result.certificate.reportId);
            setLogs(prev => [...prev, `Certificate ID generated: ${result.certificate.shortId}`]);
            if (result.emailSent) {
                setLogs(prev => [...prev, `Email sent to ${email}`]);
            } else {
                 setLogs(prev => [...prev, `Warning: Failed to send email. Error: ${result.emailError}`]);
            }
        }

    } catch(e: any) {
        clearInterval(progressInterval);
        setWipeSuccess(false);
        setLogs(prev => [...prev, `Error: ${e.message}`]);
        toast({
            variant: "destructive",
            title: "Wipe Verification Failed",
            description: e.message || "An unknown error occurred with the verification service.",
        });
    } finally {
        setProgress(100);
        setIsWiping(false);
        setWipeComplete(true);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select a Device</CardTitle>
              <CardDescription>
                Choose the storage device you want to securely wipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
             {loading ? <p>Loading devices...</p> : (
              <RadioGroup
                value={selectedDevice}
                onValueChange={setSelectedDevice}
                className="grid gap-4"
              >
                {devices.map((device) => (
                  <Label
                    key={device.id}
                    htmlFor={device.id}
                    className="flex items-center gap-4 rounded-md border p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                  >
                    <HardDrive className="h-6 w-6" />
                    <span className="flex-1">{device.name}</span>
                    <RadioGroupItem value={device.name} id={device.id} />
                  </Label>
                ))}
              </RadioGroup>
              )}
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Configure Wipe</CardTitle>
                  <CardDescription>
                    Choose a wiping method and options. The certificate will be generated and sent to the specified email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base font-medium">
                      Wipe Method
                    </Label>
                    <RadioGroup
                      value={selectedMethod}
                      onValueChange={setSelectedMethod}
                      className="mt-2 grid gap-4"
                    >
                      {wipeMethods.map((method) => (
                        <Label
                          key={method.id}
                          htmlFor={method.id}
                          className="flex flex-col rounded-md border p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-2">
                              {method.Icon && <method.Icon className="h-5 w-5" />}
                              {method.name}
                            </span>
                            <RadioGroupItem
                              value={method.id}
                              id={method.id}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {method.description}
                          </p>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2"><Mail/> Certificate Recipient Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recipient@example.com"/>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                    <ShieldQuestion size={20} /> Not Sure Which Method?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-4">Let our AI assistant recommend the best method for your needs.</p>
                    <AiSuggestionForm />
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isWiping && <Loader className="animate-spin" />}
                {wipeComplete &&
                  (wipeSuccess ? (
                    <CheckCircle className="text-green-500" />
                  ) : (
                    <XCircle className="text-red-500" />
                  ))}
                Wiping & Verifying {selectedDeviceDetails?.name}
              </CardTitle>
              <CardDescription>
                {wipeComplete
                  ? `Wipe & verification ${wipeSuccess ? "completed" : "failed"}.`
                  : "Wiping device and verifying erasure with the server. Please do not turn off your device."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="w-full" />
              <div className="mt-2 text-sm text-muted-foreground">
                {progress}% complete
              </div>
              <Accordion type="single" collapsible className="w-full mt-4" defaultValue="logs">
                <AccordionItem value="logs">
                  <AccordionTrigger>View Logs</AccordionTrigger>
                  <AccordionContent>
                    <div className="h-48 bg-gray-900 text-white font-mono text-xs rounded-md p-4 overflow-y-auto">
                      {logs.map((log, i) => (
                        <p key={i}>{log}</p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-8">
      {renderStep()}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1 || isWiping || wipeComplete}
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {step === 2 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!email}>
                Review and Start Wipe{" "}
                <Shield className="ml-2 h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is irreversible and will permanently delete all
                  data on{" "}
                  <span className="font-bold text-destructive">
                    {selectedDeviceDetails?.name}
                  </span>. A certificate will be sent to <span className="font-bold">{email}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStartWipe}>
                  Yes, Erase Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {step < 2 && (
          <Button onClick={() => setStep(step + 1)} disabled={!selectedDevice}>
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {wipeComplete && wipeSuccess && reportId && (
          <Button onClick={() => router.push(`/report/${reportId}`)}>
            View Certificate <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


export default function WipePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WipePageComponent />
    </Suspense>
  );
}
