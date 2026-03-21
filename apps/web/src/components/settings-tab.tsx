"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Wifi, Calendar, Plus, Trash2, LocateFixed } from "lucide-react";
import {
  GEOFENCE_DEFAULT_RADIUS_METERS,
  WIFI_MIN_SIGNAL_DBM,
} from "@/lib/constants";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface WifiConfig {
  id: string;
  ssid: string;
  min_signal_dbm: number;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function SettingsTab({
  classId,
  initialSchedules,
  initialLocation,
  initialWifi,
  initialQrRefreshInterval,
}: {
  classId: string;
  initialSchedules: Schedule[];
  initialLocation: Location | null;
  initialWifi: WifiConfig | null;
  initialQrRefreshInterval: number;
}) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [location, setLocation] = useState<Location | null>(initialLocation);
  const [wifi, setWifi] = useState<WifiConfig | null>(initialWifi);
  const [qrRefreshInterval, setQrRefreshInterval] = useState(initialQrRefreshInterval.toString());
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // ──── Schedule CRUD ────

  const [newDay, setNewDay] = useState("1");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");

  async function addSchedule() {
    const { data, error } = await supabase
      .from("class_schedules")
      .insert({
        class_id: classId,
        day_of_week: parseInt(newDay),
        start_time: newStart,
        end_time: newEnd,
      })
      .select("id, day_of_week, start_time, end_time")
      .single();

    if (error) return toast.error(error.message);
    setSchedules((prev) => [...prev, data]);
    toast.success("Schedule added");
  }

  async function removeSchedule(id: string) {
    const { error } = await supabase
      .from("class_schedules")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    toast.success("Schedule removed");
  }

  // ──── Location ────

  const [lat, setLat] = useState(location?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(location?.longitude?.toString() ?? "");
  const [radius, setRadius] = useState(
    location?.radius_meters?.toString() ?? GEOFENCE_DEFAULT_RADIUS_METERS.toString()
  );

  async function saveLocation() {
    if (!lat || !lng) {
      toast.error("Please enter or capture latitude and longitude");
      return;
    }
    setSaving(true);
    const payload = {
      class_id: classId,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      radius_meters: parseFloat(radius),
    };

    if (location) {
      const { error } = await supabase
        .from("class_locations")
        .update(payload)
        .eq("id", location.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("class_locations")
        .insert(payload)
        .select("id, latitude, longitude, radius_meters")
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setLocation(data);
    }

    toast.success("Location saved");
    setSaving(false);
  }

  function captureCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    toast.info("Capturing GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        toast.success("Location captured successfully");
      },
      (error) => {
        toast.error("Failed to capture location: " + error.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // ──── WiFi ────

  const [ssid, setSsid] = useState(wifi?.ssid ?? "");
  const [signal, setSignal] = useState(
    wifi?.min_signal_dbm?.toString() ??
      WIFI_MIN_SIGNAL_DBM.toString()
  );

  async function saveWifi() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const payload = {
      class_id: classId,
      teacher_id: user.id,
      ssid,
      min_signal_dbm: parseInt(signal),
    };

    if (wifi) {
      const { error } = await supabase
        .from("wifi_configs")
        .update(payload)
        .eq("id", wifi.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("wifi_configs")
        .insert(payload)
        .select("id, ssid, min_signal_dbm")
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setWifi(data);
    }

    toast.success("WiFi config saved");
    setSaving(false);
  }

  // ──── QR Settings ────
  async function saveQrSettings() {
    setSaving(true);
    const { error } = await supabase
      .from("classes")
      .update({ qr_refresh_interval: parseInt(qrRefreshInterval) })
      .eq("id", classId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("QR settings saved");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Schedules ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Class Schedules
          </CardTitle>
          <CardDescription>
            Define when this class meets each week.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded border p-3"
            >
              <span>
                {DAYS[s.day_of_week]} &middot; {s.start_time} –{" "}
                {s.end_time}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSchedule(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <Label>Day</Label>
              <Select value={newDay} onValueChange={(v) => v && setNewDay(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <Button size="sm" onClick={addSchedule}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Geofence ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geofence Location
          </CardTitle>
          <CardDescription>
            Set the classroom coordinates and radius for GPS verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 12.345678"
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 77.123456"
              />
            </div>
            <div>
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={saveLocation} disabled={saving}>
            Save Location
          </Button>
          <Button
            className="mt-4 ml-2"
            variant="outline"
            onClick={captureCurrentLocation}
          >
            <LocateFixed className="mr-2 h-4 w-4" />
            Capture Current Location
          </Button>
        </CardContent>
      </Card>

      {/* ── WiFi ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WiFi Configuration
          </CardTitle>
          <CardDescription>
            Specify the classroom WiFi SSID and minimum signal strength for
            proximity verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SSID</Label>
              <Input
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="e.g. University-WiFi"
              />
            </div>
            <div>
              <Label>Min Signal (dBm)</Label>
              <Input
                type="number"
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={saveWifi} disabled={saving}>
            Save WiFi Config
          </Button>
        </CardContent>
      </Card>

        {/* ── QR Code Settings ── */}
        <Card>
          <CardHeader>
            <CardTitle>QR Settings</CardTitle>
            <CardDescription>
              Configure the refresh interval for the generated QR code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Refresh Interval</Label>
                <Select
                  value={qrRefreshInterval}
                  onValueChange={(v) => v && setQrRefreshInterval(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select an interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Seconds</SelectItem>
                    <SelectItem value="60">1 Minute</SelectItem>
                    <SelectItem value="120">2 Minutes</SelectItem>
                    <SelectItem value="300">5 Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={saveQrSettings} disabled={saving}>
              Save QR Settings
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}
