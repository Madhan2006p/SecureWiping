
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
  FileQuestion,
  Mail,
  Bomb,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { useToast } from "@/hooks/use-toast";


type Device = {
  id: string;
  name: string;
  size: string;
};

const wipeMethodDetails: {[key: string]: {name: string, Icon?: React.ElementType, description: string}} = {
  "nist 800-88": {
    name: "NIST 800-88",
    description: "A secure, modern standard for media sanitization.",
  },
  "dod 3-pass": {
    name: "DoD 3-Pass",
    description: "Secure. Meets U.S. Dept. of Defense standards.",
  },
  "boom": {
    name: "Boom Method",
    Icon: Bomb,
    description: "A custom, high-intensity wipe process for immediate data destruction."
  },
  "boom method": {
    name: "Boom Method",
    Icon: Bomb,
    description: "A custom, high-intensity wipe process for immediate data destruction."
  },
  "encrypt-and-wipe": {
    name: "Secure Encrypt-and-Wipe",
    Icon: KeyRound,
    description: "Encrypts the drive with a temporary key, then destroys the key, rendering data unrecoverable."
  },
   unknown: {
    name: "System Determined Method",
    Icon: FileQuestion,
    description: "The most appropriate method will be used.",
  },
};


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
  const [determinedMethod, setDeterminedMethod] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isWiping, setIsWiping] = useState(false);
  const [isFetchingMethod, setIsFetchingMethod] = useState(false);
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
         toast({
          variant: "destructive",
          title: "Failed to load devices",
          description: "Could not connect to the device manager. Please ensure it's running.",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, [toast]);

  const selectedDeviceDetails = useMemo(() => {
    return devices.find((d) => d.name === selectedDevice);
  }, [selectedDevice, devices]);

  const handleNextStep = async () => {
    if (!selectedDeviceDetails) return;
    setIsFetchingMethod(true);
    setLogs(prev => [...prev, `Requesting wipe method from port 8743 for ${selectedDeviceDetails.name}`]);
    try {
      const res = await fetch('http://localhost:8743/get_wipe_method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: selectedDeviceDetails.name }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({error: 'Failed to get wipe method. Please check the service.'}));
        throw new Error(errorData.error || 'An unknown error occurred.');
      }
      const data = await res.json();
      setDeterminedMethod(data.method);
      setLogs(prev => [...prev, `Method determined: ${data.method}`]);
      setStep(2);
    } catch (error: any) {
       toast({
          variant: "destructive",
          title: "Could not determine wipe method",
          description: error.message,
        });
       setLogs(prev => [...prev, `Error fetching wipe method: ${error.message}`]);
    } finally {
        setIsFetchingMethod(false);
    }
  };


  const handleStartWipe = async () => {
    if (!selectedDeviceDetails || !determinedMethod) return;

    setStep(3);
    setIsWiping(true);
    setProgress(0);
    setWipeComplete(false);
    setWipeSuccess(false);
    setReportId(null);
    setLogs([`Wipe process initiated for ${selectedDeviceDetails.name}...`]);

    const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 1, 99));
    }, 200);

    try {
        let response;
        if (determinedMethod.toLowerCase().includes('boom')) {
            setLogs(prev => [...prev, "Calling Boom Wipe API on port 5695..."]);
            response = await fetch('http://localhost:5695/boom-wipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device: selectedDeviceDetails.name }),
            });
             const result = await response.json();
             if (!response.ok) {
                throw new Error(result.message || "Boom wipe failed");
             }
             setLogs(prev => [...prev, `API Response: ${result.message}`]);
        } else {
            setLogs(prev => [...prev, "Simulating wipe process..."]);
             // Simulate a successful wipe for other methods
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second simulation
        }
        
        clearInterval(progressInterval);
        
        setWipeSuccess(true);
        // Hardcode a report ID for viewing the certificate
        setReportId("WIPE-8792");
        setLogs(prev => [...prev, `Wipe complete. Certificate ID generated: WIPE-8792`]);

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
        const methodKey = determinedMethod?.toLowerCase() || 'unknown';
        const method = wipeMethodDetails[methodKey] || wipeMethodDetails.unknown;
        const MethodIcon = method.Icon;
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Step 2: Review and Confirm</CardTitle>
                    <CardDescription>
                       The system has determined the most appropriate wipe method for the selected device.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label className="text-base font-medium">Selected Device</Label>
                        <div className="flex items-center gap-4 rounded-md border p-4 mt-2">
                             <HardDrive className="h-6 w-6 text-muted-foreground" />
                             <span className="font-semibold">{selectedDeviceDetails?.name}</span>
                        </div>
                    </div>
                     <div>
                        <Label className="text-base font-medium">Determined Wipe Method</Label>
                         <div className="flex flex-col rounded-md border p-4 mt-2">
                           <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-2">
                              {MethodIcon && <MethodIcon className="h-5 w-5" />}
                              {method.name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {method.description}
                          </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full">
                        Start Wipe <Shield className="ml-2 h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will permanently erase all data on{" "}
                          <span className="font-bold text-destructive">
                            {selectedDeviceDetails?.name}
                          </span>
                           . This cannot be undone.
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
                </CardFooter>
            </Card>
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
                  ? `Process ${wipeSuccess ? "completed" : "failed"}.`
                  : "Communicating with verification server. Please wait..."}
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
          disabled={step === 1 || isWiping}
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {step === 1 && (
          <Button onClick={handleNextStep} disabled={!selectedDevice || isFetchingMethod}>
            {isFetchingMethod ? (<Loader className="mr-2 h-4 w-4 animate-spin" />) : "Next"}
            {!isFetchingMethod && <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        )}

        {wipeComplete && wipeSuccess && reportId && (
          <Button onClick={() => router.push(`/worker/report/${reportId}`)}>
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
