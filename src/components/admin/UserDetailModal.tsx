
import { X, Clock, ShoppingBag, Bell, Calendar, Smartphone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
}

interface UserDetail {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    advisorSessions: any[];
    shareRewards: any[];
    wishlists: {
        items: {
            product: {
                id: string;
                name: string;
                price: string;
                image: string;
            };
            addedAt: string;
        }[];
    }[];
    reminderSettings: {
        morningTime: string;
        eveningTime: string;
        days: string;
        enabled: boolean;
        pushEnabled: boolean;
    } | null;
}

export function UserDetailModal({ isOpen, onClose, userId }: UserDetailModalProps) {
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            fetch(`/api/admin/users/${userId}`)
                .then(res => res.json())
                .then(data => {
                    setUser(data);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            setUser(null);
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {loading || !user ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                        <p className="mt-4 text-sm text-slate-400">Loading user details...</p>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8 space-y-8">
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-serif text-slate-900">{user.name || "Anonymous User"}</h2>
                            <p className="text-slate-500 font-mono text-sm mt-1">{user.email}</p>
                            <div className="flex items-center gap-3 mt-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'disabled' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {user.role}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Recent Activity Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Analysis History */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Recent Analysis
                                </h3>
                                {user.advisorSessions && user.advisorSessions.length > 0 ? (
                                    <div className="space-y-3">
                                        {user.advisorSessions.slice(0, 3).map((session, idx) => (
                                            <div key={idx} className="flex items-start justify-between text-sm">
                                                <div>
                                                    <div className="font-medium text-slate-700">
                                                        {new Date(session.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 flex gap-1 items-center">
                                                        {session.deviceType === 'mobile' ? <Smartphone className="w-3 h-3" /> : 'Desktop'}
                                                        <span>•</span>
                                                        {session.province || 'Unknown Loc'}
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${session.completedAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {session.completedAt ? 'Completed' : 'Dropped'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No analysis history</p>
                                )}
                            </div>

                            {/* Reminder Settings */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Bell className="w-4 h-4" /> Reminders
                                </h3>
                                {user.reminderSettings ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Status</span>
                                            <span className={user.reminderSettings.enabled ? "text-green-600" : "text-slate-400"}>
                                                {user.reminderSettings.enabled ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Push</span>
                                            <span className={user.reminderSettings.pushEnabled ? "text-green-600" : "text-slate-400"}>
                                                {user.reminderSettings.pushEnabled ? "On" : "Off"}
                                            </span>
                                        </div>
                                        {user.reminderSettings.enabled && (
                                            <>
                                                <div className="flex justify-between border-t border-slate-200 mt-2 pt-2">
                                                    <span className="text-slate-500">Morning</span>
                                                    <span className="font-medium">{user.reminderSettings.morningTime}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Evening</span>
                                                    <span className="font-medium">{user.reminderSettings.eveningTime}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No reminders configured</p>
                                )}
                            </div>
                        </div>

                        {/* Wishlist */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4" /> Wishlist ({user.wishlists?.[0]?.items?.length || 0})
                            </h3>
                            {user.wishlists?.[0]?.items && user.wishlists[0].items.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {user.wishlists[0].items.map((item, idx) => (
                                        <div key={idx} className="flex gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                            <img
                                                src={item.product.image}
                                                alt={item.product.name}
                                                className="w-12 h-12 rounded object-cover bg-slate-100"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-900 truncate">
                                                    {item.product.name}
                                                </div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-xs text-slate-500">{item.product.price}</span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Added {new Date(item.addedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    <p className="text-sm text-slate-400">Wishlist is empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
