import { ItemList } from "@/components/item-list";
import { SettingsMenu } from "@/components/settings-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-card text-foreground">
      <main className="min-h-screen">
        <Card className="min-h-screen w-full rounded-none border-0 bg-card py-0 shadow-none">
          <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-12">
            <CardHeader className="space-y-1 px-0">
              <div className="flex items-start justify-between">
                <CardTitle className="text-2xl">Khatwa</CardTitle>
                <SettingsMenu />
              </div>
              <CardDescription>
                Add items and remove them with the X.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6 flex px-0">
              <ItemList />
            </CardContent>
          </div>
        </Card>
      </main>
    </div>
  );
}
