import { NK_LOGO_SRC } from "@/lib/nkLogo";

export default function NkLogo({
  className = "h-10 w-10 object-contain bg-black",
  alt = "N.K. Enterprise",
}: {
  className?: string;
  alt?: string;
}) {
  return <img src={NK_LOGO_SRC} alt={alt} className={className} />;
}
