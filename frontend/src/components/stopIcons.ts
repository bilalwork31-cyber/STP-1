import { CircleDot, Coffee, Flag, Fuel, Moon, Package, RotateCcw, type LucideIcon } from 'lucide-react';
import type { StopType } from '../types';

export const STOP_ICON: Record<StopType, LucideIcon> = {
  start: CircleDot,
  pickup: Package,
  dropoff: Flag,
  fuel: Fuel,
  break: Coffee,
  rest: Moon,
  restart: RotateCcw,
};
