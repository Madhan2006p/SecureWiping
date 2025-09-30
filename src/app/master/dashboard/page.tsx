
import { cookies } from 'next/headers';
import { Leaf } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getMasterUserDetails } from '@/app/actions';
import ConnectedUsers from '@/components/connected-users';

const Window = () => <div className="w-4 h-6 bg-blue-300/30 rounded-t-sm border border-blue-400/50" />;

type BuildingProps = {
  companyName: string;
  carbonEmission: number;
  isMain?: boolean;
};

const CompanyBuilding = ({ companyName, carbonEmission, isMain = false }: BuildingProps) => {
  const maxEmission = 1000;
  const emissionPercentage = (carbonEmission / maxEmission) * 100;

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      {/* Carbon Emission Display */}
      <div className="z-10 mb-4 h-24 flex items-center">
        {isMain ? (
          <div className="p-4 rounded-lg bg-background/80 border-2 border-green-500/50 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-center gap-3">
              <Leaf className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Carbon Emissions</p>
                <p className="text-2xl font-bold text-foreground">{carbonEmission}kg CO2e</p>
              </div>
            </div>
            <Progress value={emissionPercentage} className="mt-2 h-1.5" />
          </div>
        ) : (
           <div className="p-2 rounded-lg bg-background/60 border border-slate-700/50 shadow-md backdrop-blur-sm">
              <p className="text-xs text-muted-foreground text-center">CO2</p>
              <p className="text-lg font-bold text-center text-foreground">{carbonEmission}kg</p>
           </div>
        )}
      </div>

      {/* Building Name */}
      <p className={`font-bold text-lg mb-2 ${isMain ? 'text-primary' : 'text-foreground'}`}>{companyName}</p>

      {/* Game-like Building */}
      <div className="flex flex-col items-center">
        <div 
          className={`relative w-64 h-96 bg-gradient-to-b from-slate-600 to-slate-800 border-x-4 border-t-4 ${isMain ? 'border-primary/50' : 'border-slate-900'} rounded-t-lg shadow-2xl p-3 flex flex-col gap-2`}
          style={{ perspective: '1000px' }}
        >
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="h-1/5 bg-slate-700/80 border-2 border-slate-900/80 rounded-sm flex items-center justify-around px-2"
              style={{ transform: 'rotateX(5deg)' }}
            >
              <Window />
              <Window />
              <Window />
              <Window />
            </div>
          ))}
        </div>
        {/* Building Base */}
        <div className={`w-72 h-4 ${isMain ? 'bg-primary/80' : 'bg-slate-900'} rounded-b-md shadow-inner`}></div>
         {/* Ground */}
        <div className="w-96 h-2 mt-0 bg-gray-500 rounded-lg shadow-lg"></div>
      </div>
    </div>
  );
};


export default async function MasterDashboardPage() {
  let companyName = "Stark Industries";

  const sessionCookie = cookies().get('session');
  if (sessionCookie) {
    try {
      const sessionData = JSON.parse(sessionCookie.value);
      if (sessionData.username) {
        const userDetails = await getMasterUserDetails(sessionData.username);
        if (userDetails.status === 'found' && userDetails.data?.companyName) {
          companyName = userDetails.data.companyName;
        }
      }
    } catch (e) {
      console.error("Could not parse session cookie or fetch user details", e);
    }
  }

  const otherCompanies = [
    { name: "Wayne Enterprises", emission: 150 },
    { name: "Cyberdyne Systems", emission: 450 },
    { name: "Oscorp", emission: 300 },
    { name: "Tyrell Corporation", emission: 200 },
  ];


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 w-full h-[calc(100vh-10rem)] bg-muted/20 rounded-xl shadow-lg border flex items-end justify-start overflow-x-auto p-8">
        <div className="flex items-end justify-center gap-8 px-4">
            <CompanyBuilding companyName={otherCompanies[0].name} carbonEmission={otherCompanies[0].emission} />
            <CompanyBuilding companyName={otherCompanies[1].name} carbonEmission={otherCompanies[1].emission} />
            <CompanyBuilding companyName={companyName} carbonEmission={250} isMain={true} />
            <CompanyBuilding companyName={otherCompanies[2].name} carbonEmission={otherCompanies[2].emission} />
            <CompanyBuilding companyName={otherCompanies[3].name} carbonEmission={otherCompanies[3].emission} />
        </div>
      </div>
      <div className="lg:col-span-1">
        <ConnectedUsers />
      </div>
    </div>
  );
}
