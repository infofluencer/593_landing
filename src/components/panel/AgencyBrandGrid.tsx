"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { Check, Pencil } from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import AgencyBrandCard from "@/components/panel/AgencyBrandCard";
import type { HealthStatus } from "@/lib/panel/mock-data";

type BrandRow = {
  slug: string;
  name: string;
  visible: boolean;
  coverUrl: string | null;
  health: HealthStatus | null;
};

const ArrangeContext = createContext<{
  editing: boolean;
  setEditing: (next: boolean) => void;
  enabled: boolean;
} | null>(null);

export function AgencyBrandArrangeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <ArrangeContext.Provider
      value={{ editing: enabled && editing, setEditing, enabled }}
    >
      {children}
    </ArrangeContext.Provider>
  );
}

function useArrange() {
  const ctx = useContext(ArrangeContext);
  if (!ctx) {
    throw new Error("AgencyBrandArrangeProvider gerekli");
  }
  return ctx;
}

export function AgencyBrandEditButton() {
  const { editing, setEditing, enabled } = useArrange();
  return (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={editing}
      onClick={() => setEditing(!editing)}
      className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        editing
          ? "border-[#e91825]/40 bg-[#e91825] text-white hover:bg-[#d01420]"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {editing ? (
        <Check className="size-4" strokeWidth={2.2} />
      ) : (
        <Pencil className="size-4" strokeWidth={2.2} />
      )}
      {editing ? "Tamam" : "Düzenle"}
    </button>
  );
}

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("button, input, textarea, select, label, [data-no-dnd]"),
    )
  );
}

class BrandMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent }: ReactMouseEvent) => {
        if (nativeEvent.button !== 0) return false;
        return !isInteractive(nativeEvent.target);
      },
    },
  ];
}

class BrandTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent }: ReactTouchEvent) => {
        return !isInteractive(nativeEvent.target);
      },
    },
  ];
}

function swapBrands(list: BrandRow[], a: string, b: string): BrandRow[] {
  const from = list.findIndex((row) => row.slug === a);
  const to = list.findIndex((row) => row.slug === b);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const tmp = next[from];
  next[from] = next[to]!;
  next[to] = tmp!;
  return next;
}

const JIGGLE = ["brand-jiggle", "brand-jiggle brand-jiggle-b", "brand-jiggle brand-jiggle-c"] as const;

export default function AgencyBrandGrid({
  brands,
  inactive,
}: {
  brands: BrandRow[];
  inactive: boolean;
}) {
  const { editing } = useArrange();
  const [items, setItems] = useState(brands);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draggedRef = useRef(false);

  const sensors = useSensors(
    useSensor(BrandMouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(BrandTouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.4" } },
    }),
  };

  const activeBrand = activeSlug
    ? items.find((row) => row.slug === activeSlug)
    : undefined;

  async function persist(next: BrandRow[]) {
    setError(null);
    const res = await fetch("/api/panel/tenants/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: next.map((row) => row.slug) }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(json?.error || "Sıra kaydedilemedi");
      setItems(brands);
    }
  }

  function onDragStart(event: DragStartEvent) {
    if (!editing) return;
    draggedRef.current = true;
    setActiveSlug(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const from = String(event.active.id);
    const rawOver = event.over ? String(event.over.id) : null;
    const to = rawOver?.startsWith("drop:") ? rawOver.slice(5) : rawOver;
    setActiveSlug(null);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);

    if (!editing || !to || from === to) return;
    const next = swapBrands(items, from, to);
    if (next === items) return;
    setItems(next);
    void persist(next);
  }

  function onDragCancel() {
    setActiveSlug(null);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  return (
    <div className="space-y-2">
      {editing ? (
        <p className="text-xs text-zinc-500">
          Titreyen kartı sürükleyip başka bir yuvaya bırakın.
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((row, index) => (
            <BrandSlot
              key={row.slug}
              brand={row}
              index={index}
              inactive={inactive}
              editing={editing}
              suppressClickRef={draggedRef}
            />
          ))}
        </ul>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeBrand ? (
            <div className="rotate-1 scale-[1.03] shadow-xl shadow-zinc-900/10">
              <AgencyBrandCard
                slug={activeBrand.slug}
                name={activeBrand.name}
                visible={activeBrand.visible}
                coverUrl={activeBrand.coverUrl}
                health={activeBrand.health}
                inactive={inactive}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {error ? (
        <p className="text-xs text-red-600" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BrandSlot({
  brand,
  index,
  inactive,
  editing,
  suppressClickRef,
}: {
  brand: BrandRow;
  index: number;
  inactive: boolean;
  editing: boolean;
  suppressClickRef: MutableRefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: brand.slug,
    disabled: !editing,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${brand.slug}`,
    disabled: !editing,
  });

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      className={`min-h-0 ${
        editing
          ? `rounded-[1.35rem] border-2 border-dashed p-1.5 transition ${
              isOver && !isDragging
                ? "border-[#e91825] bg-[#e91825]/5"
                : "border-zinc-300 bg-zinc-50/80"
            }`
          : ""
      }`}
    >
      <div
        {...(editing ? attributes : {})}
        {...(editing ? listeners : {})}
        className={`h-full ${editing ? "touch-none" : ""} ${
          isDragging ? "opacity-25" : ""
        } ${
          editing && !isDragging ? JIGGLE[index % JIGGLE.length] : ""
        }`}
        style={
          editing && !isDragging
            ? { animationDelay: `${(index % 7) * -40}ms` }
            : undefined
        }
        onClickCapture={(event) => {
          if (!editing && !suppressClickRef.current) return;
          if (editing || suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <AgencyBrandCard
          slug={brand.slug}
          name={brand.name}
          visible={brand.visible}
          coverUrl={brand.coverUrl}
          health={brand.health}
          inactive={inactive}
          grabbing={editing}
          settled={!editing}
        />
      </div>
    </li>
  );
}
