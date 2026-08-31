import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  CubeIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon,
  EllipsisHorizontalCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  HomeIcon,
  KeyIcon,
  LightBulbIcon,
  LinkIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  PhotoIcon,
  PrinterIcon,
  QrCodeIcon,
  ScaleIcon,
  ShoppingCartIcon,
  SparklesIcon,
  SpeakerXMarkIcon,
  Squares2X2Icon,
  StarIcon,
  TagIcon,
  TruckIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const withSize = (Icon: HeroIcon) => {
  function SizedIcon({ size = 20, className, ...props }: IconProps) {
    return <Icon width={size} height={size} className={className} {...props} />
  }
  return SizedIcon
}

export const Archive = withSize(ArchiveBoxIcon)
export const ArrowLeft = withSize(ArrowLeftIcon)
export const ArrowRight = withSize(ArrowRightIcon)
export const Box = withSize(CubeIcon)
export const CalendarDays = withSize(CalendarDaysIcon)
export const Camera = withSize(CameraIcon)
export const Check = withSize(CheckIcon)
export const CheckCircle2 = withSize(CheckCircleIcon)
export const ChevronDown = withSize(ChevronDownIcon)
export const ChevronLeft = withSize(ChevronLeftIcon)
export const ChevronRight = withSize(ChevronRightIcon)
export const CircleDashed = withSize(EllipsisHorizontalCircleIcon)
export const CreditCard = withSize(CreditCardIcon)
export const Flashlight = withSize(LightBulbIcon)
export const House = withSize(HomeIcon)
export const KeyRound = withSize(KeyIcon)

export function Keyboard({ size = 20, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true" {...props}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 10.5h.01M10 10.5h.01M13 10.5h.01M16 10.5h.01M8.5 13.5h.01M11.5 13.5h.01M14.5 13.5h.01" strokeLinecap="round" />
      <path d="M8 16.25h8" strokeLinecap="round" />
    </svg>
  )
}
export const LayoutGrid = withSize(Squares2X2Icon)
export const Link2 = withSize(LinkIcon)
export const LoaderCircle = withSize(ArrowPathIcon)
export const LogIn = withSize(ArrowRightEndOnRectangleIcon)
export const LogOut = withSize(ArrowRightOnRectangleIcon)
export const Mail = withSize(EnvelopeIcon)
export const Mic = withSize(MicrophoneIcon)
export const MicOff = withSize(SpeakerXMarkIcon)
export const MousePointerClick = withSize(CursorArrowRaysIcon)
export const Package = withSize(CubeIcon)
export const PackageOpen = withSize(CubeIcon)
export const Phone = withSize(PhoneIcon)
export const PhoneOff = withSize(PhoneXMarkIcon)
export const Printer = withSize(PrinterIcon)
export const RefreshCcw = withSize(ArrowPathIcon)
export const Scale = withSize(ScaleIcon)
export const ScanBarcode = withSize(QrCodeIcon)
export const Send = withSize(PaperAirplaneIcon)
export const Settings = withSize(Cog6ToothIcon)
export const ShoppingCart = withSize(ShoppingCartIcon)
export const Smartphone = withSize(DevicePhoneMobileIcon)
export const Sparkles = withSize(SparklesIcon)
export const Stamp = withSize(TagIcon)
export const Star = withSize(StarIcon)
export const Truck = withSize(TruckIcon)
export const ViewColumns = withSize(ViewColumnsIcon)
export const Warehouse = withSize(BuildingOffice2Icon)
export const X = withSize(XMarkIcon)
export const Photo = withSize(PhotoIcon)
export const AlertCircle = withSize(ExclamationCircleIcon)
