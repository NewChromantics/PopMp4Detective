export default 'App.js';
import Pop from './PopEngineCommon/PopEngine.js'
import {Mp4Decoder} from './PopEngineCommon/Mp4.js'

let TableGui = null;
let TreeGui = null;
let TreeGuiElement = null;
let Mp4Tree = {};
let Mp4Atoms = [];
let Mp4Samples = [];


function UpdateTreeGui(Json)
{
	if ( !TreeGuiElement )
		return;
	
	if ( Json != null )
		Mp4Tree = Json;
	
	let Tree = {};
	Tree.Atoms = Mp4Tree;
	Tree.Samples = Mp4Samples;
	
	TreeGuiElement.json = Tree;
	
	//	display nodes with their fourcc
	//	again, regex would be good here
	let Meta = TreeGuiElement.meta;	//	save existing meta, collapsed state etc
	
	for ( let Key in Json )
	{
		const MetaKey = `Atoms.${Key}`;
		const KeyMeta = Meta[MetaKey] || {};
		KeyMeta.KeyAsLabel = 'Fourcc';
		Meta[MetaKey] = KeyMeta;
	}
	TreeGuiElement.meta = Meta;
}

function PushMp4Atoms(Atoms)
{
	function ToRow(Atom)
	{
		const Row = {};
		Row.Fourcc = Atom.Fourcc;
		Row.FilePosition = Atom.FilePosition;
		Row.HeaderSize = Atom.HeaderSize;
		Row.ContentSize = Atom.ContentSize;
		return Row;
	}

	const Rows = Atoms.map(ToRow);
	Mp4Atoms.push(...Rows);
	if ( TableGui )
		TableGui.SetValue(Mp4Atoms.concat(Mp4Samples));
}

function PushMp4Samples(Samples)
{
	//	eof but refresh
	if ( !Samples )
	{
		UpdateTreeGui(null);
		return;
	}
	
	function ToRow(Sample)
	{
		const Row = {};
		Row.DecodeTimeMs = Sample.DecodeTimeMs;
		Row.PresentationTimeMs = Sample.PresentationTimeMs;
		Row.ContentSize = Sample.DataSize;
		Row.Keyframe = Sample.IsKeyframe ? 'Keyframe' : '';
		Row.FilePosition = Sample.FilePosition || Sample.DataFilePosition || Sample.DataPosition;
		Row.Flags = `0x` + Sample.Flags.toString(16);
		return Row;
	}

	const Rows = Samples.map(ToRow);
	Mp4Samples.push(...Rows);
	if ( TableGui )
		TableGui.SetValue(Mp4Atoms.concat(Mp4Samples));
		
	UpdateTreeGui(null);
}

function ClearMp4Sections()
{
	Mp4Samples = [];
	Mp4Atoms = [];
	Mp4Tree = null;
	UpdateTreeGui(null);
}


export async function LoadMp4(Filename)
{
	const Mp4 = new Mp4Decoder();
	
	async function UpdateGuiThread()
	{
		//	todo? break out when we know there'll be no more changes
		while ( Mp4 )
		{
			const NewRootAtoms = await Mp4.WaitForChange();
			UpdateTreeGui( NewRootAtoms );
		}
	}
	UpdateGuiThread();
	
	ClearMp4Sections();
	
	//	async callback for new data
	async function ReadDecodedAtomThread()
	{
		while ( true )
		{
			const Atom = await Mp4.WaitForNextAtom();
			PushMp4Atoms( [Atom] );
			//	detect EOF
		}
	}
	async function ReadDecodedSampleThread()
	{
		while ( true )
		{
			const Samples = await Mp4.WaitForNextSamples();
			PushMp4Samples( Samples );
			//	eof
			if ( !Samples )
				break;
		}
	}
	const DecodeAtomThreadPromise = ReadDecodedAtomThread();
	const DecodeSampleThreadPromise = ReadDecodedSampleThread();
	
	//	async loading & feeding data
	async function ReadFileThread()
	{
		function OnNewChunk(Contents)
		{
			Mp4.PushData(Contents);
		}
		const ResolveChunks = false;
		const FilePromise = Pop.FileSystem.LoadFileAsArrayBufferStreamAsync(Filename,ResolveChunks,OnNewChunk);
		await FilePromise;
		Mp4.PushEndOfFile();
	}
	const ReadFilePromise = ReadFileThread();
	
	const WaitAllResult = await Promise.all( [DecodeAtomThreadPromise,DecodeSampleThreadPromise,ReadFilePromise] );
	Pop.Debug(`File loaded; ${WaitAllResult}`,WaitAllResult);
}

export function SetTable(Name)
{
	TableGui = new Pop.Gui.Table(null,Name);
	DragAndDropThread(TableGui).catch(Pop.Warning);
}

export function SetTreeView(Name)
{
	TreeGuiElement = document.querySelector(`#${Name}`);
	TreeGui = new Pop.Gui.Tree(TreeGuiElement,Name);
	DragAndDropThread(TreeGui).catch(Pop.Warning);
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
