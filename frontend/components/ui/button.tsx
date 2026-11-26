import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out-soft outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-alta to-crimson text-primary-foreground shadow-[inset_0_1.2px_0_0_color-mix(in_oklch,var(--brand-cream)_22%,transparent),0_10px_26px_-16px_color-mix(in_oklch,var(--brand-crimson)_85%,transparent)] hover:from-alta/92 hover:to-crimson/92",
        gold: "bg-linear-to-r from-saffron to-marigold text-mahogany shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--brand-cream)_55%,transparent),0_12px_30px_-16px_color-mix(in_oklch,var(--brand-marigold)_85%,transparent)] hover:from-saffron/94 hover:to-marigold/94",
        glass:
          "border-cream/20 bg-cream/12 text-cream backdrop-blur-[2px] hover:border-cream/30 hover:bg-cream/20",
        outline:
          "border-border bg-transparent text-foreground hover:border-primary/45 hover:bg-primary/5 aria-expanded:border-primary/45 aria-expanded:bg-primary/5",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground",
        destructive:
          "border-destructive/25 bg-destructive/[0.07] text-destructive hover:border-destructive/35 hover:bg-destructive/13 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/[0.14] dark:hover:bg-destructive/22 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
