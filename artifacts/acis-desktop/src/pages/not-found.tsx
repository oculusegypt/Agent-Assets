import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
          <AlertCircle size={36} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-6xl font-mono font-bold text-primary mb-2">404</h1>
          <h2 className="text-xl font-bold text-foreground mb-2">الصفحة غير موجودة</h2>
          <p className="text-muted-foreground text-sm">
            الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
        </div>
        <Link href="/">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/20 transition-colors cursor-pointer">
            <Home size={16} />
            <span className="font-medium">العودة للرئيسية</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
