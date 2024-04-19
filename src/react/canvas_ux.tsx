/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useEffect, useState } from "react";
import { Conference } from "../schema/app_schema.js";
import { ClientSession } from "../schema/session_schema.js";
import {
	ConnectionState,
	IFluidContainer,
	IMember,
	IServiceAudience,
	Tree,
	TreeView,
} from "fluid-framework";
import { RootSessionWrapper } from "./session_ux.js";
import {
	Floater,
	NewDayButton,
	NewSessionButton,
	DeleteSessionsButton,
	ButtonGroup,
	UndoButton,
	RedoButton,
	DeleteDayButton,
	ShowPromptButton,
} from "./button_ux.js";
import { undefinedUserId } from "../utils/utils.js";
import { undoRedo } from "../utils/undo.js";
import { SessionsView } from "./sessions_ux.js";

export function Canvas(props: {
	conferenceTree: TreeView<typeof Conference>;
	sessionTree: TreeView<typeof ClientSession>;
	audience: IServiceAudience<IMember>;
	container: IFluidContainer;
	fluidMembers: string[];
	currentUser: string;
	undoRedo: undoRedo;
	setCurrentUser: (arg: string) => void;
	setConnectionState: (arg: string) => void;
	setSaved: (arg: boolean) => void;
	setFluidMembers: (arg: string[]) => void;
	setShowPrompt: (arg: boolean) => void;
}): JSX.Element {
	const [invalidations, setInvalidations] = useState(0);

	// Register for tree deltas when the component mounts.
	// Any time the tree changes, the app will update
	// For more complex apps, this code can be included
	// on lower level components.
	useEffect(() => {
		const unsubscribe = Tree.on(props.conferenceTree.root, "treeChanged", () => {
			setInvalidations(invalidations + Math.random());
		});
		return unsubscribe;
	}, []);

	useEffect(() => {
		const updateConnectionState = () => {
			if (props.container.connectionState === ConnectionState.Connected) {
				props.setConnectionState("connected");
			} else if (props.container.connectionState === ConnectionState.Disconnected) {
				props.setConnectionState("disconnected");
			} else if (props.container.connectionState === ConnectionState.EstablishingConnection) {
				props.setConnectionState("connecting");
			} else if (props.container.connectionState === ConnectionState.CatchingUp) {
				props.setConnectionState("catching up");
			}
		};
		updateConnectionState();
		props.setSaved(!props.container.isDirty);
		props.container.on("connected", updateConnectionState);
		props.container.on("disconnected", updateConnectionState);
		props.container.on("dirty", () => props.setSaved(false));
		props.container.on("saved", () => props.setSaved(true));
		props.container.on("disposed", updateConnectionState);
	}, []);

	const updateMembers = () => {
		if (props.audience.getMyself() == undefined) return;
		if (props.audience.getMyself()?.userId == undefined) return;
		if (props.audience.getMembers() == undefined) return;
		if (props.container.connectionState !== ConnectionState.Connected) return;
		if (props.currentUser == undefinedUserId) {
			const user = props.audience.getMyself()?.userId;
			if (typeof user === "string") {
				props.setCurrentUser(user);
			}
		}
		props.setFluidMembers(Array.from(props.audience.getMembers().keys()));
	};

	useEffect(() => {
		props.audience.on("membersChanged", updateMembers);
		return () => {
			props.audience.off("membersChanged", updateMembers);
		};
	}, []);

	return (
		<div className="relative flex grow-0 h-full w-full bg-transparent">
			<ConferenceView
				conference={props.conferenceTree.root}
				clientId={props.currentUser}
				clientSession={props.sessionTree.root}
				fluidMembers={props.fluidMembers}
			/>
			<Floater>
				<ButtonGroup>
					<NewSessionButton
						conference={props.conferenceTree.root}
						clientId={props.currentUser}
					/>
					<DeleteSessionsButton
						session={props.sessionTree.root}
						conference={props.conferenceTree.root}
						clientId={props.currentUser}
					/>
					<NewDayButton
						days={props.conferenceTree.root.days}
						session={props.sessionTree.root}
						clientId={props.currentUser}
					/>
					<DeleteDayButton
						days={props.conferenceTree.root.days}
						session={props.sessionTree.root}
						clientId={props.currentUser}
					/>
					<ShowPromptButton show={props.setShowPrompt} />
				</ButtonGroup>
				<ButtonGroup>
					<UndoButton undo={() => props.undoRedo.undo()} />
					<RedoButton redo={() => props.undoRedo.redo()} />
				</ButtonGroup>
			</Floater>
		</div>
	);
}

export function ConferenceView(props: {
	conference: Conference;
	clientId: string;
	clientSession: ClientSession;
	fluidMembers: string[];
}): JSX.Element {
	const sessionArray = [];
	for (const i of props.conference.sessions) {
		sessionArray.push(
			<RootSessionWrapper
				key={i.id}
				session={i}
				clientId={props.clientId}
				clientSession={props.clientSession}
				fluidMembers={props.fluidMembers}
			/>,
		);
	}

	return (
		<div className="flex flex-col h-full w-full content-start overflow-auto">
			<div className="flex w-full p-4">
				<SessionsView sessions={props.conference.sessions} title="Unscheduled" {...props} />
			</div>
			<div className="flex flex-row h-full w-full flex-nowrap gap-4 p-4 content-start">
				<DaysView {...props} />
			</div>
			<div className="flex w-full h-24"></div>
		</div>
	);
}

// React component that renders each day in the conference side by side
export function DaysView(props: {
	conference: Conference;
	clientId: string;
	clientSession: ClientSession;
	fluidMembers: string[];
}): JSX.Element {
	const dayArray = [];
	for (const day of props.conference.days) {
		dayArray.push(
			<SessionsView
				key={Tree.key(day)}
				sessions={day}
				clientSession={props.clientSession}
				clientId={props.clientId}
				fluidMembers={props.fluidMembers}
				title={"Day " + ((Tree.key(day) as number) + 1)}
			/>,
		);
	}

	return <>{dayArray}</>;
}
