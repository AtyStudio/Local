import { useEffect, useMemo, useState } from "react";
import { useGetListing, useRecordContactClick } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";
import { useRoute, Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { api, type FullProfileResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Send,
  MessageSquare,
  Loader2,
  CheckCircle,
  Eye,
  MousePointerClick,
  ShieldCheck,
  Flag,
  Sofa,
  Calendar,
  WalletCards,
  User,
  CircleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { computeProfileCompletion, getRoomTypeLabelKey, getTenantGenderLabelKey, getListingFitReasonKeys } from "@/lib/match-utils";
import { buildStructuredRequestMessage, getRequestStatusMeta } from "@/lib/request-utils";
import { useTranslation } from "react-i18next";
import { ReportDialog } from "@/components/ReportDialog";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80";

type RequestState = "idle" | "sending" | "pending" | "accepted" | "declined";

export default function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const id = parseInt(params?.id || "0", 10);
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<RequestState>("idle");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestMoveIn, setRequestMoveIn] = useState("");
  const [requestBudget, setRequestBudget] = useState("");
  const [profileContext, setProfileContext] = useState<FullProfileResponse | null>(null);
  const [isMsgSending, setIsMsgSending] = useState(false);
  const [isReportListingOpen, setIsReportListingOpen] = useState(false);
  const [isReportUserOpen, setIsReportUserOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const recordContactClickMutation = useRecordContactClick();
  const { data: listing, isLoading, error } = useGetListing(id, {
    query: { queryKey: [`/api/listings/${id}`], enabled: !!id },
  });

  useEffect(() => {
    if (!user || user.role !== "seeker" || !id) return;
    api.getFavoriteIds().then((ids) => setIsFavorited(ids.includes(id))).catch(() => {});
    api.getRequests().then((requests) => {
      const current = requests.find((request) => request.listingId === id);
      if (current) setRequestStatus(current.status);
    }).catch(() => {});
    api.getProfile().then((profile) => {
      setProfileContext(profile);
      setRequestMoveIn(profile.profile?.moveInDate || "");
      const min = profile.preferences?.budgetMin ? Math.round(parseFloat(profile.preferences.budgetMin)) : null;
      const max = profile.preferences?.budgetMax ? Math.round(parseFloat(profile.preferences.budgetMax)) : null;
      setRequestBudget(min && max ? `${min} - ${max} MAD` : max ? `Up to ${max} MAD` : min ? `${min} MAD+` : "");
      const introName = profile.profile?.fullName || user.name || user.email.split("@")[0];
      const occupation = profile.profile?.occupation ? ` I work/study as ${profile.profile.occupation}.` : "";
      setRequestNote(`Hi, I'm ${introName}.${occupation} I'd like to know if this listing is still available.`);
    }).catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const sessionKey = `viewed_listing_${id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/listings/${id}/view`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [id]);

  const fitReasons = useMemo(() => (listing ? getListingFitReasonKeys(listing, profileContext) : []), [listing, profileContext]);
  const profileCompletion = profileContext ? computeProfileCompletion(profileContext) : 0;

  const toggleFavorite = async () => {
    if (!user) return setLocation("/login");
    setIsFavLoading(true);
    try {
      if (isFavorited) {
        await api.removeFavorite(id);
        setIsFavorited(false);
        toast({ title: t("listings.detail.removedFromFavorites") });
      } else {
        await api.addFavorite(id);
        setIsFavorited(true);
        toast({ title: t("listings.detail.savedForLater") });
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("common.error"), description: err instanceof Error ? err.message : t("common.error") });
    } finally {
      setIsFavLoading(false);
    }
  };

  const sendStructuredRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !listing) return setLocation("/login");
    const message = buildStructuredRequestMessage({
      requesterName: profileContext?.profile?.fullName || user.name || user.email.split("@")[0],
      occupation: profileContext?.profile?.occupation || "Not shared",
      moveIn: requestMoveIn,
      budget: requestBudget,
      note: requestNote,
    });

    setRequestStatus("sending");
    try {
      const created = await api.sendRequest({ listingId: id, message });
      setRequestStatus(created.status);
      setShowRequestForm(false);
      toast({ title: t("listings.detail.requestSent"), description: t("listings.detail.requestSentStructuredDesc") });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already")) {
        setRequestStatus("pending");
      } else {
        setRequestStatus("idle");
      }
      toast({
        variant: msg.includes("already") ? "default" : "destructive",
        title: msg.includes("already") ? t("listings.detail.alreadyRequested") : t("common.error"),
        description: msg || t("listings.detail.requestFailed"),
      });
    }
  };

  const openMessages = async () => {
    if (!user || !listing) return setLocation("/login");
    if (requestStatus === "idle") {
      setShowRequestForm(true);
      return toast({ title: t("listings.detail.sendRequestFirst"), description: t("listings.detail.sendRequestFirstDesc") });
    }
    if (requestStatus === "pending") {
      return toast({ title: t("listings.detail.requestStillPending"), description: t("listings.detail.requestPendingDesc") });
    }
    if (requestStatus === "declined") {
      return toast({ title: t("dashboard.requestDeclined"), description: t("listings.detail.requestDeclinedDesc") });
    }
    setIsMsgSending(true);
    recordContactClickMutation.mutate({ id });
    try {
      await api.sendMessage({ receiverId: listing.ownerId, listingId: id, body: `Hi, I sent a request for "${listing.title}" and had a quick follow-up question.` });
      setLocation(`/messages/${listing.ownerId}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Messaging opens only after the owner accepts a request")) {
        setRequestStatus("pending");
        toast({ variant: "destructive", title: t("listings.detail.requestStillPending"), description: t("listings.detail.requestPendingDesc") });
        setIsMsgSending(false);
        return;
      }
      setLocation(`/messages/${listing.ownerId}`);
    } finally {
      setIsMsgSending(false);
    }
  };

  const submitListingReport = async (payload: { reason: "scam" | "fake_listing" | "fake_profile" | "spam" | "harassment" | "unsafe" | "other"; details?: string }) => {
    if (!listing) return;
    setIsSubmittingReport(true);
    try {
      await api.reportListing(listing.id, payload);
      setIsReportListingOpen(false);
      toast({ title: t("reports.submittedTitle"), description: t("reports.submittedDescription") });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("common.error"), description: err instanceof Error ? err.message : t("reports.submitFailed") });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const submitUserReport = async (payload: { reason: "scam" | "fake_listing" | "fake_profile" | "spam" | "harassment" | "unsafe" | "other"; details?: string }) => {
    if (!listing) return;
    setIsSubmittingReport(true);
    try {
      await api.reportUser(listing.ownerId, payload);
      setIsReportUserOpen(false);
      toast({ title: t("reports.submittedTitle"), description: t("reports.submittedDescription") });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("common.error"), description: err instanceof Error ? err.message : t("reports.submitFailed") });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background flex flex-col"><Navbar /><div className="flex-grow flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></div>;
  if (error || !listing) return <div className="min-h-screen bg-background flex flex-col"><Navbar /><div className="flex-grow flex items-center justify-center"><div className="text-center"><h2 className="text-2xl font-bold text-foreground">{t("listings.detail.listingNotFound")}</h2><Link href="/" className="text-primary hover:underline mt-4 inline-block">{t("listings.detail.returnHome")}</Link></div></div></div>;

  const images = listing.images?.length ? listing.images : [FALLBACK_IMAGE];
  const totalUpfront = listing.deposit ? listing.price + listing.deposit : listing.price;
  const isOwner = user?.id === listing.ownerId;
  const isSeeker = user?.role === "seeker";
  const requestStatusMeta = getRequestStatusMeta(requestStatus === "sending" ? "pending" : requestStatus);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <ReportDialog
        open={isReportListingOpen}
        onOpenChange={setIsReportListingOpen}
        targetLabel={t("reports.listingTarget")}
        onSubmit={submitListingReport}
        isSubmitting={isSubmittingReport}
      />
      <ReportDialog
        open={isReportUserOpen}
        onOpenChange={setIsReportUserOpen}
        targetLabel={t("reports.userTarget")}
        onSubmit={submitUserReport}
        isSubmitting={isSubmittingReport}
      />
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> {t("listings.detail.backToSearch")}</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsReportListingOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"><Flag className="h-4 w-4" /> {t("reports.reportListing")}</button>
            {isSeeker && <button onClick={toggleFavorite} disabled={isFavLoading} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2", isFavorited ? "bg-red-50 text-red-600 border-red-200" : "bg-card border-border text-muted-foreground")}><Heart className={cn("w-4 h-4", isFavorited ? "fill-red-500 text-red-500" : "")} />{isFavorited ? t("listings.detail.saved") : t("listings.detail.save")}</button>}
          </div>
        </div>

        <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden mb-4 shadow-lg border border-border">
          <img src={images[activeIndex]} alt={listing.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 text-white max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md"><MapPin className="h-3.5 w-3.5 text-primary" /> {listing.city}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md"><Sofa className="h-3.5 w-3.5 text-primary" /> {t(getRoomTypeLabelKey(listing.roomType))}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {listing.isIdentityVerified && listing.isLocationVerified ? t("listings.card.trust.checkedListing") : t("listings.detail.trustDetailsBelow")}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight">{listing.title}</h1>
          </div>
          {images.length > 1 && <>
            <button onClick={() => setActiveIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => setActiveIndex((i) => (i + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
          </>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <TrustCard icon={WalletCards} label="Monthly rent" value={formatPrice(listing.price)} />
              <TrustCard icon={WalletCards} label="Deposit" value={listing.deposit ? formatPrice(listing.deposit) : "Not specified"} />
              <TrustCard icon={WalletCards} label="Estimated upfront" value={formatPrice(totalUpfront)} />
              <TrustCard icon={Sofa} label="Furnishing" value={listing.furnished ? "Furnished" : "Unfurnished"} />
              <TrustCard icon={Calendar} label="Available from" value={listing.availableFrom ? format(new Date(listing.availableFrom), "MMM d, yyyy") : "Flexible"} />
              <TrustCard icon={Calendar} label="Utilities" value={listing.utilitiesIncluded ? "Included in rent" : "Paid separately"} />
            </div>

            <section className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">About this listing</h2>
              <p className="text-muted-foreground leading-relaxed">{listing.description || `A listing in ${listing.city} with the basics covered.`}</p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <TrustCard icon={Sofa} label="Room type" value={t(getRoomTypeLabelKey(listing.roomType))} />
                <TrustCard icon={User} label="Preferred tenant" value={t(getTenantGenderLabelKey(listing.preferredTenantGender))} />
                <TrustCard icon={Calendar} label="Minimum stay" value={listing.minStayMonths ? `${listing.minStayMonths} months` : "Flexible"} />
                <TrustCard icon={Calendar} label="Listed on" value={listing.createdAt ? format(new Date(listing.createdAt), "MMM d, yyyy") : "Recently"} />
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">House rules and expectations</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{listing.houseRules || "The owner has not added detailed house rules yet. Ask about guests, smoking, quiet hours, and shared spaces before committing."}</p>
              </div>
            </section>

            <section className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">Trust and transparency</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatusPill positive={listing.isIdentityVerified} label={listing.isIdentityVerified ? "Identity checked" : "Identity check pending"} />
                <StatusPill positive={listing.isLocationVerified} label={listing.isLocationVerified ? "Location checked" : "Location not yet checked"} />
                <StatusPill positive={(listing.images?.length || 0) >= 4} label={(listing.images?.length || 0) >= 4 ? "Good photo coverage" : "More photos recommended"} />
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/60 dark:bg-amber-950/20"><p className="text-sm text-muted-foreground">Keep communication on SakanMatch, confirm the exact address in person, and never send money before visiting.</p></div>
            </section>

            {isSeeker && <section className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div><h2 className="text-xl font-display font-bold text-foreground">Roommate fit</h2><p className="text-sm text-muted-foreground mt-1">We compare this listing with the preferences you already shared.</p></div>
                {profileContext && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Profile {profileCompletion}% complete</span>}
              </div>
              {fitReasons.length > 0 ? <div className="flex flex-wrap gap-2">{fitReasons.map((reason) => <span key={reason} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-foreground">{t(`listings.detail.fitReasons.${reason}`)}</span>)}</div> : <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">{t("listings.detail.completeProfileForFit")} <Link href="/profile" className="font-semibold text-primary hover:underline">{t("dashboard.completeProfileBtn")}</Link></div>}
            </section>}

            {isSeeker && !isOwner && <section className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div><h2 className="text-xl font-display font-bold text-foreground">Send a request before messaging</h2><p className="text-sm text-muted-foreground mt-1">A structured intro helps owners trust you faster than an empty chat.</p></div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Status: {requestStatus === "idle" ? "Not sent" : requestStatus}</span>
              </div>
              {requestStatus !== "idle" && requestStatus !== "sending" && <div className={cn("mb-4 rounded-xl border px-4 py-4", requestStatus === "accepted" ? "border-green-200 bg-green-50" : requestStatus === "declined" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}><div className="flex items-center gap-3"><CircleAlert className="w-5 h-5 text-primary" /><p className="text-sm text-foreground">{t(requestStatusMeta.descriptionKey)}</p></div></div>}
              {!showRequestForm ? <button onClick={() => setShowRequestForm(true)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-md shadow-primary/20"><Send className="w-4 h-4" /> Send request to owner</button> : <form onSubmit={sendStructuredRequest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="date" value={requestMoveIn} onChange={(e) => setRequestMoveIn(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground" />
                  <input type="text" value={requestBudget} onChange={(e) => setRequestBudget(e.target.value)} placeholder="Budget summary" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground" />
                </div>
                <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground resize-none" />
                <div className="flex gap-3">
                  <button type="submit" disabled={requestStatus === "sending"} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-md shadow-primary/20">{requestStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send request</button>
                  <button type="button" onClick={() => setShowRequestForm(false)} className="px-6 py-3 rounded-xl font-medium text-muted-foreground border-2 border-border">Cancel</button>
                </div>
              </form>}
            </section>}
          </div>

          <aside className="lg:col-span-1">
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-xl shadow-black/5 sticky top-28">
              <div className="text-center pb-6 border-b border-border mb-6">
                <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Monthly rent</span>
                <div className="text-4xl font-display font-bold text-foreground mt-2">{formatPrice(listing.price)}</div>
                <p className="text-sm text-muted-foreground mt-2">{listing.deposit ? `${formatPrice(listing.deposit)} deposit required` : "Deposit not listed yet"}</p>
              </div>
              <div className="space-y-4">
                <div className="bg-secondary/50 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"><span className="text-sm font-bold text-foreground">{(listing.ownerName || listing.ownerEmail || "O")[0].toUpperCase()}</span></div>
                    <div><p className="text-xs text-muted-foreground">{t("listings.detail.owner")}</p><p className="text-sm font-semibold text-foreground">{listing.ownerName || listing.ownerEmail?.split("@")[0] || t("listings.detail.owner")}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SmallBadge positive={listing.isIdentityVerified} label={listing.isIdentityVerified ? t("listings.detail.identityChecked") : t("listings.detail.identityPending")} />
                    <SmallBadge positive={listing.isLocationVerified} label={listing.isLocationVerified ? t("listings.detail.locationChecked") : t("listings.detail.locationPending")} />
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link href={`/profile/${listing.ownerId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"><User className="h-4 w-4" /> {t("listings.detail.viewOwnerProfile")}</Link>
                    <button onClick={() => setIsReportUserOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground"><Flag className="h-4 w-4" /> {t("reports.reportUser")}</button>
                  </div>
                </div>
                {isOwner && listing.isFeatured && listing.viewCount !== null && <div className="grid grid-cols-2 gap-2"><Metric label="Views" value={listing.viewCount} icon={<Eye className="w-4 h-4 text-primary mx-auto mb-1" />} /><Metric label="Clicks" value={listing.contactClickCount ?? 0} icon={<MousePointerClick className="w-4 h-4 text-primary mx-auto mb-1" />} /></div>}
                {!isOwner && user && <button onClick={openMessages} disabled={isMsgSending || requestStatus === "pending" || requestStatus === "declined"} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-70">{isMsgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}{requestStatus === "accepted" ? "Message owner" : requestStatus === "pending" ? "Waiting for owner approval" : requestStatus === "declined" ? "Request declined" : "Send request to unlock messages"}</button>}
                {!isOwner && user && requestStatus !== "idle" && <p className="text-center text-xs text-muted-foreground">{t(requestStatusMeta.titleKey)}: {t(requestStatusMeta.descriptionKey)}</p>}
                {!user && <Link href="/login" className="w-full block text-center bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md">Log in to request this listing</Link>}
                {isOwner && <div className="text-center text-sm text-muted-foreground p-3 bg-secondary/50 rounded-xl">This is your listing</div>}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function TrustCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-background px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-sm font-semibold text-foreground">{value}</p></div></div></div>;
}

function StatusPill({ positive, label }: { positive: boolean; label: string }) {
  return <div className={cn("rounded-2xl border px-4 py-4", positive ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20" : "border-border bg-background")}><div className="flex items-center gap-2">{positive ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}<p className="text-sm font-semibold text-foreground">{label}</p></div></div>;
}

function SmallBadge({ positive, label }: { positive: boolean; label: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", positive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-secondary text-muted-foreground")}><ShieldCheck className="h-3 w-3" />{label}</span>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="bg-background rounded-xl border border-border p-3 text-center">{icon}<p className="text-xl font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
