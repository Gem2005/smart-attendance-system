"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentsTab } from "@/components/students-tab";
import { AttendanceTab } from "@/components/attendance-tab";
import { QRTab } from "@/components/qr-tab";
import { SettingsTab } from "@/components/settings-tab";

interface Schedule {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Location {
  id: string;
  class_id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface WifiConfig {
  id: string;
  class_id: string;
  teacher_id: string;
  ssid: string;
  min_signal_dbm: number;
}

interface AttendanceSession {
  id: string;
  session_date: string;
  started_at: string;
  is_active: boolean;
}

export function ClassTabs({
  classId,
  schedules,
  location,
  wifiConfig,
  qrRefreshInterval,
  token,
  initialSessions = [],
}: {
  classId: string;
  schedules: Schedule[];
  location: Location | null;
  wifiConfig: WifiConfig | null;
  qrRefreshInterval: number;
  token?: string;
  initialSessions?: AttendanceSession[];
}) {
  return (
    <Tabs defaultValue="students" className="space-y-4">
      <TabsList>
        <TabsTrigger value="students">Students</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="qr">QR Code</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="students">
        <StudentsTab classId={classId} token={token} />
      </TabsContent>

      <TabsContent value="attendance">
        <AttendanceTab classId={classId} token={token} initialSessions={initialSessions} />
      </TabsContent>

      <TabsContent value="qr">
        <QRTab classId={classId} schedules={schedules} qrRefreshInterval={qrRefreshInterval} token={token} />
      </TabsContent>

      <TabsContent value="settings">
        <SettingsTab
          classId={classId}
          initialSchedules={schedules}
          initialLocation={location}
          initialWifi={wifiConfig}
          initialQrRefreshInterval={qrRefreshInterval}
          token={token}
        />
      </TabsContent>
    </Tabs>
  );
}
