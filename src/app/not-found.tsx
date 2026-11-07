import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="card gate">
      <div className="gate-icon">
        <Icon name="clock" />
      </div>
      <h1>Nothing here</h1>
      <p className="muted">This paste doesn&apos;t exist. It may have expired, been deleted, or been burned after reading.</p>
      <Link href="/" className="btn btn-primary">
        Go to Pastekar
      </Link>
    </div>
  );
}
