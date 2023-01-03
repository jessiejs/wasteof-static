// Import the express in typescript file
import express, { Application, Request, Response } from 'express';
import { Renderer } from './renderer';
import { createWriteStream } from 'fs';

// Initialize the express engine
const app: Application = express();

// Take a port 3000 for running server.
const port: number = 3000;

// Handling feed
app.get('/', async (req: Request, res: Response) => {
	const renderer = new Renderer(res);

	await renderer.htmlTemplate(async () => {
		await renderer.renderFeedOfUser('thenextannoyance');
	});

	res.end();
});

// Handling user
app.get('/users/:username', async (req: Request, res: Response) => {
	const renderer = new Renderer(res);

	await renderer.htmlTemplate(async () => {
		await renderer.renderUserFeed(req.params.username);
	});

	res.end();
});

// Server setup
app.listen(port, () => {
	console.log(`Running on port ${port}`);
});
