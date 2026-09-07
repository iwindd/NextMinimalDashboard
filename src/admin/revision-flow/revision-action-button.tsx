"use client";

import { Button, type ButtonProps } from "@mantine/core";
import type { ButtonHTMLAttributes } from "react";
import {
  getRevisionActionPresentation,
  type RevisionActionKey,
} from "./ui-policy";

type RevisionActionButtonProps = Omit<
  ButtonProps & ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "color" | "variant"
> & {
  action: RevisionActionKey;
  contentNoun?: string;
};

export function RevisionActionButton({
  action,
  contentNoun,
  ...props
}: RevisionActionButtonProps) {
  const presentation = getRevisionActionPresentation(action, contentNoun);

  return (
    <Button
      {...props}
      variant={presentation.variant}
      color={presentation.color}
    >
      {presentation.label}
    </Button>
  );
}
