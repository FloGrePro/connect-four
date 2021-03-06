import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ColorService } from './color.service';
import {Tile} from '../models/tile';
import { AddRound, UpdateRound, ClearRound } from '../shared/actions/round.ations';
import { Player } from '../models/player';
import { Store } from '@ngxs/store';
import { Round } from '../models/round';
import { Turn } from '../models/turn';

@Injectable()
export class GameService{

  //Inject services and store
  constructor(private colorService: ColorService,private store: Store) { }

  //Maximum nummber of collumns
  maxCols = 7;
  //Maximum nummber of lines
  maxLines = 6;

  //The game tiles
  tiles:Tile[][];
  public tilesSubject: Subject<Tile[][]> = new BehaviorSubject<Tile[][]>([]);
  public tilesActive = this.tilesSubject.asObservable();

  //The game current message
  message:string;
  public messageSubject: Subject<string> = new BehaviorSubject<string>('');
  public messageActive = this.messageSubject.asObservable();

  //Player's scores
  player1Score:number;
  public player1ScoreSubject: Subject<number> = new BehaviorSubject<number>(0);
  public player1ScoreActive = this.player1ScoreSubject.asObservable();
  player2Score:number;
  public player2ScoreSubject: Subject<number> = new BehaviorSubject<number>(0);
  public player2ScoreActive = this.player2ScoreSubject.asObservable();

  //The current player playing
  playerPlaying = 1;
  player1 :Player;
  player2 :Player;


  //The current round
  currentRound:Round;
  currentRoundWin=false;
  public currentRoundWinSubject: Subject<boolean> = new BehaviorSubject<boolean>(false);
  public currentRoundWinActive = this.currentRoundWinSubject.asObservable();

  //Initialize white tiles
  clearTiles(){
    this.tiles = [];
    //Init game tiles
    for (let colIndex = 0; colIndex < this.maxCols; colIndex++) {
      this.tiles[colIndex] = [];
      for (let lineIndex = 0; lineIndex < this.maxLines; lineIndex++) {
        this.tiles[colIndex][lineIndex]= new Tile(this.colorService.DEFAULT_COLOR);
      }
    }
    this.tilesSubject.next(this.tiles);
  }

  //Game initialization
  initNewGame(){
    //Clear tiles
    this.clearTiles();
    //Init players
    let idFirstPlayer = 1;
    let idSecondPlayer = 2;
    this.playerPlaying=idFirstPlayer;
    this.player1 = new Player('Player1Name',idFirstPlayer);
    this.player2 = new Player('Player2Name',idSecondPlayer);

    //Notify listeners
    this.messageSubject.next('Player'+this.playerPlaying+'Turn');
    this.tilesSubject.next(this.tiles);
    this.player1Score=0;
    this.player2Score=0;
    this.player1ScoreSubject.next(this.player1Score);
    this.player2ScoreSubject.next(this.player1Score);

    //Init round in store
    let id = 1;
    let turns = [{player:this.player1,tileDropped:new Array<number>()}];
    this.store.dispatch(new ClearRound());
    this.updateRoundOnInit(false,'',turns,id)
  }

  //New round initialization
  initNewRound(){
    //Clear tiles
    this.clearTiles();
    this.playerPlaying=1;
    //Notify listeners
    this.messageSubject.next('Player'+this.playerPlaying+'Turn');

    //Init round in store
    let turns = [{player:this.player1,tileDropped:new Array<number>()}];
    this.updateRoundOnInit(false,'',turns,this.currentRound.id+1)
  }

  //Analyse if the game is win or not by the last player
  isGameWin():boolean{
    //Fetch all win conditions and return true if game is win
    if(this.fetchXY()){
      //Update message and round for the win
      this.messageSubject.next('Player'+this.playerPlaying+'Win');
      this.updateRoundOnWin(true,'Player'+this.playerPlaying+'Name');

      //Update players's score
      if(this.playerPlaying==1){
        this.player1Score=this.player1Score+1;
        this.player1ScoreSubject.next(this.player1Score);
      }
      else{
        this.player2Score=this.player2Score+1;
        this.player2ScoreSubject.next(this.player2Score);
      }
      //Update current round
      this.store.dispatch(new UpdateRound(this.currentRound));
      return true;
    }
    //No winner this trun and match not null
    if(this.getAvailableCollumns().length!=0){
      if(this.playerPlaying == 1){
        this.playerPlaying=2;
      }
      else{
        this.playerPlaying=1;
      }
      this.messageSubject.next('Player'+this.playerPlaying+'Turn');
      return false;
    }
    //Match null
    else{
      this.currentRoundWinSubject.next(true);
      this.currentRound.winner='Nobody';
      this.messageSubject.next('DrawGame');
    }
    return false;
  }

  //The function to drop a coin in the board
  coinDrop(col:number):boolean{
    if(!this.currentRoundWin){
      if(col<this.maxCols && col>=0){
        //Get the player  color
        let playerColorClass = this.colorService.getPlayerColor(this.playerPlaying)

        //Search for the  to set the color
        let line = 0;
        for (let tile of this.tiles[col]) {
          if(tile.color==this.colorService.DEFAULT_COLOR){
            tile.color=playerColorClass;
            break;
          }
          if(line+1==6){
            break;
          }
          line++;
        }
        this.tilesSubject.next(this.tiles);

        //Return if the game is win this turn
        return this.isGameWin();
      }
      else{
        return false;
      }
    }
    return true;
  }

  //Update round and all variable linked too
  updateRoundOnWin(valRoundWin:boolean, valRoundWinner:string){
    this.currentRoundWinSubject.next(valRoundWin);
    this.currentRoundWin=valRoundWin;
    this.currentRound.winner=valRoundWinner;
  }

  //Update round and all variable linked too
  updateRoundOnInit(valRoundWin:boolean, valRoundWinner:string, turns:Turn[], id:number){
    this.currentRound = new Round(id,turns,valRoundWinner);
    this.currentRoundWin=valRoundWin;
    this.currentRoundWinSubject.next(valRoundWin);
    this.store.dispatch(new AddRound(this.currentRound));
  }

  //Return an array of all available columns
  getAvailableCollumns(){
    //Return variable
    let columnsAvailable=[];

    //Iterate on columns
    for (let colIndex = 0; colIndex < this.maxCols; colIndex++) {
      let columnAvailable = false;
      //Iterate on lines
      for (let lineIndex = 0; lineIndex < this.maxLines; lineIndex++) {
        if(!columnAvailable && this.tiles[colIndex][lineIndex].color==this.colorService.DEFAULT_COLOR){
          columnAvailable = true;
          columnsAvailable.push(colIndex);
        }
      }
    }
    return columnsAvailable;
  }

  //Iterate and check the win conditions in the actual board for the given player
  fetchXY():boolean{
    //TODO rework this for only check the played s and not the whole board each time
    let playerColor = this.colorService.getPlayerColor(this.playerPlaying);
    //All directions to fetch for
    let directions = [[1,0], [1,-1], [1,1], [0,1]];
    //is win check
    let isWin = false;

    for (let dir of directions) {
      //Getting current directions
      let dCol = dir[0];
      let dLine = dir[1];
      //Iterate on the collumns
      for (let colIndex = 0; colIndex < this.maxCols; colIndex++) {
        //Iterate on the lines
        for (let lineIndex = 0; lineIndex < this.maxLines; lineIndex++) {
          //Getting the last col and line indexes
          let lastCol = colIndex + 3*dCol;
          let lastLine = lineIndex + 3*dLine;
          //Checking if we are not out of limits
          if (0 <= lastCol && lastCol < this.maxCols && 0 <= lastLine && lastLine < this.maxLines) {
            //Check if we are not on an empty  and if so, check the near s for win condition
            if (playerColor != this.colorService.DEFAULT_COLOR
              && playerColor == this.tiles[colIndex][lineIndex].color
              && playerColor == this.tiles[colIndex+dCol][lineIndex+dLine].color
              && playerColor == this.tiles[colIndex+2*dCol][lineIndex+2*dLine].color
              && playerColor == this.tiles[lastCol][lastLine].color) {
                this.tiles[colIndex][lineIndex].color+=this.colorService.COLOR_WIN;
                this.tiles[colIndex+dCol][lineIndex+dLine].color+=this.colorService.COLOR_WIN;
                this.tiles[colIndex+2*dCol][lineIndex+2*dLine].color+=this.colorService.COLOR_WIN;
                this.tiles[lastCol][lastLine].color+=this.colorService.COLOR_WIN;
                //Game is win by the player
                isWin = true;
            }
          }
        }
      }
    }
    //Return win
    return isWin
  }
}
