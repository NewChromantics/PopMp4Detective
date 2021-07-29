export default 'App.js';
import Pop from './PopEngineCommon/PopEngine.js'
import {Mp4Decoder} from './PopEngineCommon/Mp4.js'

let TableGui = null;
let Mp4Sections = [];

function PushMp4Atom(Atom)
{
	function AtomToRow(Atom)
	{
		const Row = {};
		Row.Fourcc = Atom.Fourcc;
		Row.HeaderSize = Atom.HeaderSize;
		Row.ContentSize = Atom.ContentSize;
		return Row;
	}

	const Row = AtomToRow(Atom);
	Mp4Sections.push(Row);
	TableGui.SetValue(Mp4Sections);
}

function ClearMp4Sections()
{
	Mp4Sections = [];
}


export async function LoadMp4(Filename)
{
	const Mp4 = new Mp4Decoder();
	ClearMp4Sections();
	
	//	async callback for new data
	async function ReadDecodedThread()
	{
		while ( true )
		{
			const Atom = await Mp4.WaitForNextAtom();
			PushMp4Atom( Atom );
			//	detect EOF
		}
	}
	const DecodeThreadPromise = ReadDecodedThread();
	
	//	async loading & feeding data
	async function ReadFileThread()
	{
		function OnNewChunk(Contents)
		{
			Mp4.PushData(Contents);
		}
		const ResolveChunks = false;
		const FilePromise = Pop.FileSystem.LoadFileAsArrayBufferStreamAsync(Filename,ResolveChunks,OnNewChunk);
		return await FilePromise;
	}
	const ReadFilePromise = ReadFileThread();
	
	const WaitAllResult = await Promise.all( [DecodeThreadPromise,ReadFilePromise] );
	Pop.Debug(`File loaded; ${WaitAllResult}`,WaitAllResult);
}

export function SetTable(Name)
{
	TableGui = new Pop.Gui.Table(null,Name);
	DragAndDropThread(TableGui).catch(Pop.Warning);
}

async function DragAndDropThread(DropTargetElement)
{
	while(DropTargetElement)
	{
		const DroppedFilename = await DropTargetElement.WaitForDragDrop();
		Pop.Debug(`Dropped File; ${DroppedFilename}`);
		await LoadMp4(DroppedFilename);
	}
}
