package io.skiplabs.types;

public class CPointer {
  private long handle;
  private long field1;

  public CPointer(long handle, long field1) {
    this.handle = handle;
    this.field1 = field1;
  }

  public B getField1() {
    if (this.handle == 0L) throw new NullPointerException();
    return callField1(this.handle, this.field1);
  }

  public void clear() {
    this.handle = 0L;
    this.field1 = 0L;
  }

  private native B callField1(long handler, long function);

  private native static CPointer callCreate(long context, long field1);


}